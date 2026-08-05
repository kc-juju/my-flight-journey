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
  const places = placesOfJourney(journey, byId);
  const legs = travelled(journey);
  const distance = legs.reduce((sum, s) => sum + segmentDistanceKm(s, byId), 0);
  const modes = [...new Set(legs.map((s) => s.mode))];

  return {
    days: inclusiveDays(journey.startDate, journey.endDate),
    segmentCount: legs.length,
    flightCount: legs.filter((s) => s.mode === 'flight').length,
    cityCount: new Set(places.map((p) => p.name)).size,
    countryCount: new Set(places.map((p) => p.countryCode)).size,
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
    for (const place of placesOfJourney(journey, byId)) {
      cities.add(place.name);
      countries.add(place.countryCode);
      if (place.code) airports.add(place.code);
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

export function journeyYear(journey: Journey): number {
  return Number(journey.startDate.slice(0, 4));
}

export function sortByDateDesc(a: Journey, b: Journey): number {
  return a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0;
}
