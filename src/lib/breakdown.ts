import type { AtlasData, Journey, Place, Segment, TransportMode } from '../types/journey';
import { citiesOfJourney, placesOfJourney, segmentDistanceKm, travelled } from './atlas';

/** Everything the stats page slices, computed once from the leg list. */
export interface CountryRow {
  code: string;
  name: string;
  visits: number;
  journeys: number;
  places: Place[];
  /** Ids of places that were more than a connection. */
  visitedIds: Set<string>;
  /**
   * Places grouped by the city they serve. Tokyo has two airports and Osaka
   * two more, so counting places would overstate how many cities were seen.
   */
  cities: { name: string; places: Place[] }[];
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

/** One airport, with everywhere it connects to and how often. */
export interface AirportRow {
  place: Place;
  /** Times this airport was used, counting each departure and each arrival. */
  calls: number;
  departures: number;
  arrivals: number;
  journeys: number;
  firstDate: string;
  lastDate: string;
  partners: {
    place: Place;
    count: number;
    outbound: number;
    inbound: number;
    km: number;
  }[];
}

/** Aircraft grouped by family, each keeping the individual models flown. */
export interface FamilyRow {
  family: string;
  manufacturer: string;
  count: number;
  km: number;
  models: Tally[];
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
  airportDetail: AirportRow[];
  routes: Tally[];
  operators: Tally[];
  aircraft: Tally[];
  aircraftFamilies: FamilyRow[];
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

/**
 * Collapse a model name to its family. "Boeing 787-9" and "Boeing 787-10" are
 * the same aeroplane to a passenger; an A320 and an A321neo are the same
 * cabin. Anything unrecognised keeps its own name rather than being forced
 * into a bucket it does not belong in.
 */
export function aircraftFamily(model: string): { family: string; manufacturer: string } {
  const m = model.trim();
  const boeing = m.match(/Boeing\s*(7\d)7/i);
  if (boeing) return { family: `Boeing ${boeing[1]}7`, manufacturer: 'Boeing' };
  if (/A3(1|2)\d/i.test(m)) return { family: 'Airbus A320 family', manufacturer: 'Airbus' };
  const airbus = m.match(/A(3[3-8]0)/i);
  if (airbus) return { family: `Airbus A${airbus[1]}`, manufacturer: 'Airbus' };
  if (/MD-?8\d/i.test(m)) return { family: 'McDonnell Douglas MD-80', manufacturer: 'McDonnell Douglas' };
  if (/(DHC-?8|Dash\s*8)/i.test(m)) return { family: 'De Havilland Dash 8', manufacturer: 'De Havilland Canada' };
  if (/ATR\s*\d/i.test(m)) return { family: 'ATR 42/72', manufacturer: 'ATR' };
  if (/Embraer|E-?Jet|ERJ/i.test(m)) return { family: 'Embraer E-Jet', manufacturer: 'Embraer' };
  return { family: m, manufacturer: m.split(/\s+/)[0] };
}

export function buildBreakdown(data: AtlasData, placesById: Map<string, Place>): Breakdown {
  const counted = data.journeys.filter((j) => j.status !== 'bucket');

  const countries = new Map<string, CountryRow>();
  const detail = new Map<string, AirportRow>();
  const journeysPerAirport = new Map<string, Set<string>>();

  const airportRow = (place: Place, date: string): AirportRow => {
    const row = detail.get(place.id) ?? {
      place,
      calls: 0,
      departures: 0,
      arrivals: 0,
      journeys: 0,
      firstDate: date,
      lastDate: date,
      partners: [],
    };
    if (date < row.firstDate) row.firstDate = date;
    if (date > row.lastDate) row.lastDate = date;
    detail.set(place.id, row);
    return row;
  };

  const link = (row: AirportRow, other: Place, km: number, outbound: boolean) => {
    let partner = row.partners.find((p) => p.place.id === other.id);
    if (!partner) {
      partner = { place: other, count: 0, outbound: 0, inbound: 0, km };
      row.partners.push(partner);
    }
    partner.count += 1;
    if (outbound) partner.outbound += 1;
    else partner.inbound += 1;
  };
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
    const visitedPlaces = citiesOfJourney(journey, placesById);
    const journeyCountries = new Set(visitedPlaces.map((p) => p.countryCode));
    const visitedIds = new Set(visitedPlaces.map((p) => p.id));

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
        visitedIds: new Set<string>(),
        cities: [] as { name: string; places: Place[] }[],
        firstDate: journey.startDate,
        lastDate: journey.endDate,
        distanceKm: 0,
      };
      if (!row.places.some((p) => p.id === place.id)) row.places.push(place);
      if (visitedIds.has(place.id)) row.visitedIds.add(place.id);
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

      // Arriving somewhere by train is still arriving: a visit counts whatever
      // carried you. The airport picture below is a different question — a
      // coach calling at Venice is not a flight through VCE — so calls,
      // routes and connections are counted from flights alone.
      const flight = segment.mode === 'flight';
      // A journey only counts against an airport if a flight touched it.
      const flew = (id: string) =>
        journeysPerAirport.set(
          id,
          (journeysPerAirport.get(id) ?? new Set<string>()).add(journey.id),
        );
      if (from) {
        const row = countries.get(from.countryCode);
        if (row) row.visits += 1;
      }
      if (to) {
        const row = countries.get(to.countryCode);
        if (row) row.visits += 1;
      }
      if (flight && from) {
        const a = airportRow(from, journey.startDate);
        a.calls += 1;
        a.departures += 1;
        flew(from.id);
      }
      if (flight && to) {
        const a = airportRow(to, journey.startDate);
        a.calls += 1;
        a.arrivals += 1;
        flew(to.id);
      }
      if (flight && from && to && from.id !== to.id) {
        link(airportRow(from, journey.startDate), to, km, true);
        link(airportRow(to, journey.startDate), from, km, false);
      }
      if (flight && from && to) {
        const pair = [from.code ?? from.id, to.code ?? to.id].sort().join(' — ');
        bump(routes, pair, pair, km, `${Math.round(km).toLocaleString('en-US')} km`);
      }
      if (from && to) {
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
    const byCity = new Map<string, Place[]>();
    for (const place of row.places) {
      // A city only ever passed through in transit is not a city visited.
      if (!row.visitedIds.has(place.id)) continue;
      byCity.set(place.name, [...(byCity.get(place.name) ?? []), place]);
    }
    row.cities = [...byCity.entries()]
      .map(([name, places]) => ({ name, places }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const yearRows = [...years.values()].sort((a, b) => a.year - b.year);
  for (const row of yearRows) {
    row.countries = new Set(
      counted
        .filter((j) => Number(j.startDate.slice(0, 4)) === row.year)
        .flatMap((j) => placesOfJourney(j, placesById).map((p) => p.countryCode)),
    ).size;
  }

  for (const [id, set] of journeysPerAirport) {
    const row = detail.get(id);
    if (row) row.journeys = set.size;
  }
  for (const row of detail.values()) {
    row.partners.sort((a, b) => b.count - a.count || a.place.name.localeCompare(b.place.name));
  }

  const families = new Map<string, FamilyRow>();
  for (const model of aircraft.values()) {
    const { family, manufacturer } = aircraftFamily(model.label);
    const row = families.get(family) ?? {
      family,
      manufacturer,
      count: 0,
      km: 0,
      models: [] as Tally[],
    };
    row.count += model.count;
    row.km += model.distanceKm ?? 0;
    row.models.push(model);
    families.set(family, row);
  }
  for (const row of families.values()) row.models.sort(byCount);

  return {
    aircraftFamilies: [...families.values()].sort(
      (a, b) => b.count - a.count || a.family.localeCompare(b.family),
    ),
    airportDetail: [...detail.values()].sort(
      (a, b) => b.calls - a.calls || a.place.name.localeCompare(b.place.name),
    ),
    countries: [...countries.values()].sort(
      (a, b) => b.visits - a.visits || a.name.localeCompare(b.name),
    ),
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
