import type { AtlasData, Journey, Place, Segment, TransportMode } from '../types/journey';
import { placesOfJourney, segmentDistanceKm, travelled } from './atlas';

/** Everything the stats page slices, computed once from the leg list. */
export interface CountryRow {
  code: string;
  name: string;
  visits: number;
  journeys: number;
  places: Place[];
  firstDate: string;
  lastDate: string;
  distanceKm: number;
}

export interface Tally {
  key: string;
  label: string;
  count: number;
  distanceKm?: number;
  sub?: string;
}

export interface YearRow {
  year: number;
  journeys: number;
  legs: number;
  distanceKm: number;
  minutes: number;
  countries: number;
  newCountries: string[];
}

export interface Breakdown {
  countries: CountryRow[];
  airports: Tally[];
  routes: Tally[];
  operators: Tally[];
  aircraft: Tally[];
  cabins: Tally[];
  years: YearRow[];
  longest?: { segment: Segment; journey: Journey; km: number };
  shortest?: { segment: Segment; journey: Journey; km: number };
  busiestYear?: YearRow;
  averageJourneyDays: number;
  averageLegKm: number;
  homeCountry?: string;
  modeTotals: Partial<Record<TransportMode, number>>;
}

const bump = (map: Map<string, Tally>, key: string, label: string, km = 0, sub?: string) => {
  const row = map.get(key) ?? { key, label, count: 0, distanceKm: 0, sub };
  row.count += 1;
  row.distanceKm = (row.distanceKm ?? 0) + km;
  if (sub && !row.sub) row.sub = sub;
  map.set(key, row);
};

const byCount = (a: Tally, b: Tally) => b.count - a.count || a.label.localeCompare(b.label);

export function buildBreakdown(data: AtlasData, placesById: Map<string, Place>): Breakdown {
  const counted = data.journeys.filter((j) => j.status !== 'bucket');

  const countries = new Map<string, CountryRow>();
  const airports = new Map<string, Tally>();
  const routes = new Map<string, Tally>();
  const operators = new Map<string, Tally>();
  const aircraft = new Map<string, Tally>();
  const cabins = new Map<string, Tally>();
  const years = new Map<number, YearRow>();
  const modeTotals: Partial<Record<TransportMode, number>> = {};

  let longest: Breakdown['longest'];
  let shortest: Breakdown['shortest'];
  let totalDays = 0;
  let totalLegs = 0;
  let totalKm = 0;
  const seenCountries = new Set<string>();

  // Home is the country the traveller starts from most often.
  const starts = new Map<string, number>();
  for (const journey of counted) {
    const first = travelled(journey)[0];
    const place = first && placesById.get(first.fromPlaceId);
    if (place) starts.set(place.countryCode, (starts.get(place.countryCode) ?? 0) + 1);
  }
  const homeCountry = [...starts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  for (const journey of [...counted].sort((a, b) => (a.startDate < b.startDate ? -1 : 1))) {
    const year = Number(journey.startDate.slice(0, 4));
    const legs = travelled(journey);
    const journeyKm = legs.reduce((sum, s) => sum + segmentDistanceKm(s, placesById), 0);
    const journeyMinutes = legs.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
    const journeyPlaces = placesOfJourney(journey, placesById);
    const journeyCountries = new Set(journeyPlaces.map((p) => p.countryCode));

    const yearRow = years.get(year) ?? {
      year,
      journeys: 0,
      legs: 0,
      distanceKm: 0,
      minutes: 0,
      countries: 0,
      newCountries: [] as string[],
    };
    yearRow.journeys += 1;
    yearRow.legs += legs.length;
    yearRow.distanceKm += journeyKm;
    yearRow.minutes += journeyMinutes;
    for (const code of journeyCountries) {
      if (!seenCountries.has(code)) {
        seenCountries.add(code);
        yearRow.newCountries.push(code);
      }
    }
    years.set(year, yearRow);

    totalKm += journeyKm;
    totalLegs += legs.length;
    totalDays +=
      Math.round(
        (Date.parse(`${journey.endDate}T00:00:00Z`) -
          Date.parse(`${journey.startDate}T00:00:00Z`)) / 86_400_000,
      ) + 1;

    for (const place of journeyPlaces) {
      const row = countries.get(place.countryCode) ?? {
        code: place.countryCode,
        name: place.country,
        visits: 0,
        journeys: 0,
        places: [] as Place[],
        firstDate: journey.startDate,
        lastDate: journey.endDate,
        distanceKm: 0,
      };
      if (!row.places.some((p) => p.id === place.id)) row.places.push(place);
      row.lastDate = journey.endDate;
      countries.set(place.countryCode, row);
    }
    for (const code of journeyCountries) {
      const row = countries.get(code);
      if (row) {
        row.journeys += 1;
        row.distanceKm += journeyKm / journeyCountries.size;
      }
    }

    for (const segment of legs) {
      const from = placesById.get(segment.fromPlaceId);
      const to = placesById.get(segment.toPlaceId);
      const km = segmentDistanceKm(segment, placesById);
      modeTotals[segment.mode] = (modeTotals[segment.mode] ?? 0) + 1;

      if (from) {
        bump(airports, from.id, from.airportName ?? from.name, 0, from.country);
        const row = countries.get(from.countryCode);
        if (row) row.visits += 1;
      }
      if (to) {
        bump(airports, to.id, to.airportName ?? to.name, 0, to.country);
        const row = countries.get(to.countryCode);
        if (row) row.visits += 1;
      }
      if (from && to) {
        const pair = [from.code ?? from.id, to.code ?? to.id].sort().join(' — ');
        bump(routes, pair, pair, km, `${Math.round(km).toLocaleString('en-US')} km`);
        if (!longest || km > longest.km) longest = { segment, journey, km };
        if (!shortest || km < shortest.km) shortest = { segment, journey, km };
      }
      if (segment.operator) bump(operators, segment.operator, segment.operator, km);
      if (segment.vehicle) bump(aircraft, segment.vehicle, segment.vehicle, km);
      if (segment.cabin) bump(cabins, segment.cabin, segment.cabin, km);
    }
  }

  for (const row of countries.values()) {
    row.places.sort((a, b) => a.name.localeCompare(b.name));
  }

  const yearRows = [...years.values()].sort((a, b) => a.year - b.year);
  for (const row of yearRows) {
    row.countries = new Set(
      counted
        .filter((j) => Number(j.startDate.slice(0, 4)) === row.year)
        .flatMap((j) => placesOfJourney(j, placesById).map((p) => p.countryCode)),
    ).size;
  }

  return {
    countries: [...countries.values()].sort(
      (a, b) => b.visits - a.visits || a.name.localeCompare(b.name),
    ),
    airports: [...airports.values()].sort(byCount),
    routes: [...routes.values()].sort(byCount),
    operators: [...operators.values()].sort(byCount),
    aircraft: [...aircraft.values()].sort(byCount),
    cabins: [...cabins.values()].sort(byCount),
    years: yearRows,
    longest,
    shortest,
    busiestYear: [...yearRows].sort((a, b) => b.distanceKm - a.distanceKm)[0],
    averageJourneyDays: counted.length ? totalDays / counted.length : 0,
    averageLegKm: totalLegs ? totalKm / totalLegs : 0,
    homeCountry,
    modeTotals,
  };
}
