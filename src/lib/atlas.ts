import type {
  AtlasData,
  AtlasMetrics,
  Journey,
  JourneyMetrics,
  Place,
  Segment,
  TransportMode,
} from '../types/journey';
import { TRANSPORT_MODES } from '../types/journey';
import { distanceKm } from './geo';
import { localToInstant } from './time';

/** Index places by id so components never scan the array. */
export function indexPlaces(places: Place[]): Map<string, Place> {
  return new Map(places.map((p) => [p.id, p]));
}

/** Legs that actually happened — everything derived counts only these. */
export const travelled = (journey: Journey): Segment[] =>
  journey.segments.filter((s) => !s.dropped);

export function placesOfJourney(journey: Journey, byId: Map<string, Place>): Place[] {
  const seen = new Set<string>();
  const out: Place[] = [];
  const push = (id: string) => {
    const place = byId.get(id);
    if (place && !seen.has(id)) {
      seen.add(id);
      out.push(place);
    }
  };
  journey.stops.forEach((s) => push(s.placeId));
  travelled(journey).forEach((s) => {
    push(s.fromPlaceId);
    push(s.toPlaceId);
  });
  return out;
}

/**
 * Places actually visited — the same list minus anywhere that was only a
 * connection. Airports still count; a city seen from a departure lounge does
 * not.
 */
export function citiesOfJourney(journey: Journey, byId: Map<string, Place>): Place[] {
  const transfers = new Set(journey.transferPlaceIds ?? []);
  return placesOfJourney(journey, byId).filter((p) => !transfers.has(p.id));
}

/**
 * A journey named by where it went, not what country it was in — nine trips
 * to Japan all called 'Japan' say nothing about which was which.
 */
export function journeyLabel(
  journey: Journey,
  byId: Map<string, Place>,
  max = 5,
): string {
  const year = journey.startDate.slice(0, 4);
  // A trip that covered a whole region reads better named after it than
  // after the first four towns; journey-notes.json says when that is so.
  if (journey.label) return `${year} · ${journey.label}`;
  const seen: string[] = [];
  for (const place of citiesOfJourney(journey, byId)) {
    if (place.home || seen.includes(place.name)) continue;
    seen.push(place.name);
  }
  if (!seen.length) return `${year} · ${journey.title}`;
  const shown = seen.slice(0, max).join(' · ');
  return `${year} · ${shown}${seen.length > max ? ` +${seen.length - max}` : ''}`;
}

function inclusiveDays(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
}

export function segmentDistanceKm(segment: Segment, byId: Map<string, Place>): number {
  const from = byId.get(segment.fromPlaceId);
  const to = byId.get(segment.toPlaceId);
  if (!from || !to) return 0;
  return distanceKm(from, to);
}

/** Everything the UI shows about a journey is derived here, never authored. */
export function journeyMetrics(journey: Journey, byId: Map<string, Place>): JourneyMetrics {
  // Home is where every journey starts and ends, so counting it would say
  // '3 countries' about a trip to two. A domestic trip keeps its own country,
  // because the places it reached are not home.
  const visited = citiesOfJourney(journey, byId).filter((p) => !p.home);
  const legs = travelled(journey);
  const distance = legs.reduce((sum, s) => sum + segmentDistanceKm(s, byId), 0);
  const modes = [...new Set(legs.map((s) => s.mode))];

  return {
    days: inclusiveDays(journey.startDate, journey.endDate),
    segmentCount: legs.length,
    flightCount: legs.filter((s) => s.mode === 'flight').length,
    cityCount: new Set(visited.map((p) => p.name)).size,
    countryCount: new Set(visited.map((p) => p.countryCode)).size,
    distanceKm: Math.round(distance),
    durationMinutes: legs.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0),
    modes: TRANSPORT_MODES.filter((m) => modes.includes(m)),
  };
}

export function atlasMetrics(data: AtlasData): AtlasMetrics {
  const byId = indexPlaces(data.places);
  const counted = data.journeys.filter((j) => j.status !== 'bucket');

  const cities = new Set<string>();
  const countries = new Set<string>();
  const airports = new Set<string>();
  const operators = new Set<string>();
  const vehicles = new Set<string>();
  const modeTotals = Object.fromEntries(
    TRANSPORT_MODES.map((m) => [m, 0]),
  ) as Record<TransportMode, number>;

  let distance = 0;
  let flights = 0;
  let segments = 0;

  for (const journey of counted) {
    // Airports count wherever the aeroplane touched down; cities and
    // countries only where the journey actually stopped.
    for (const place of placesOfJourney(journey, byId)) {
      if (place.code) airports.add(place.code);
    }
    for (const place of citiesOfJourney(journey, byId)) {
      cities.add(place.name);
      countries.add(place.countryCode);
    }
    for (const segment of travelled(journey)) {
      segments += 1;
      modeTotals[segment.mode] += 1;
      if (segment.mode === 'flight') flights += 1;
      if (segment.operator) operators.add(segment.operator);
      if (segment.vehicle) vehicles.add(segment.vehicle);
      distance += segmentDistanceKm(segment, byId);
    }
  }

  return {
    journeyCount: data.journeys.length,
    completedCount: data.journeys.filter((j) => j.status === 'completed').length,
    plannedCount: data.journeys.filter((j) => j.status === 'planned').length,
    distanceKm: Math.round(distance),
    flightCount: flights,
    segmentCount: segments,
    cityCount: cities.size,
    countryCount: countries.size,
    airportCount: airports.size,
    operatorCount: operators.size,
    vehicleCount: vehicles.size,
    years: [...new Set(data.journeys.map((j) => Number(j.startDate.slice(0, 4))))].sort(
      (a, b) => a - b,
    ),
    modeTotals,
  };
}

/**
 * Time on the ground between two consecutive legs, in minutes.
 *
 * Timezone-aware: Doha departs at 09:00 local after a Seoul arrival at 14:35
 * local, which is a nine-hour wait, not a five-hour negative one.
 */
export function layoverMinutes(
  before: Segment,
  after: Segment,
  byId: Map<string, Place>,
): number | null {
  if (before.toPlaceId !== after.fromPlaceId) return null;
  const zone = byId.get(before.toPlaceId)?.timezone;
  if (!zone) return null;
  if (!before.arrival?.includes('T') || !after.departure?.includes('T')) return null;
  const minutes =
    (localToInstant(after.departure, zone).getTime() -
      localToInstant(before.arrival, zone).getTime()) /
    60_000;
  return minutes >= 0 ? Math.round(minutes) : null;
}

export function journeyYear(journey: Journey): number {
  return Number(journey.startDate.slice(0, 4));
}

export function sortByDateDesc(a: Journey, b: Journey): number {
  return a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0;
}
