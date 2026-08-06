/**
 * Domain model for the travel atlas.
 *
 * A Journey is the primary entity. Flights are only one kind of Segment;
 * a Journey may equally be made of trains, cars, buses, ferries or walking.
 */

export const TRANSPORT_MODES = [
  'flight',
  'train',
  'car',
  'bus',
  'ferry',
  'walk',
  /** Moved between two points by means the log does not record. */
  'surface',
] as const;

export type TransportMode = (typeof TRANSPORT_MODES)[number];

export type JourneyStatus = 'completed' | 'planned' | 'bucket';

/** A point on the map. Referenced by id so coordinates live in exactly one place. */
export interface Place {
  id: string;
  name: string;
  /** IATA airport code, station code, port code — whatever identifies the node. */
  code?: string;
  /** Readable airport name — the marker sits on the airport, not the city. */
  airportName?: string;
  country: string;
  countryCode: string;
  /** Landmass the country is filed under, for grouping the atlas. */
  continent?: string;
  lat: number;
  lon: number;
  /**
   * IANA zone, resolved from the coordinates. Used to read a photo's local
   * timestamp when its EXIF carries no UTC offset.
   */
  timezone?: string;
  /** Representative photo, served from /public. */
  image?: string;
  /** Home base — every journey starts and ends here, so galleries skip it. */
  home?: boolean;
}

/** One leg of a journey, in any transport mode. */
export interface Segment {
  id: string;
  mode: TransportMode;
  /** Airline, rail operator, ferry line… */
  operator?: string;
  /** Flight number, train name, route number… */
  reference?: string;
  fromPlaceId: string;
  toPlaceId: string;
  /** Local date-time, ISO 8601 without zone (the local clock at each end). */
  departure?: string;
  arrival?: string;
  durationMinutes?: number;
  /** Aircraft type, rolling stock, vessel… */
  vehicle?: string;
  /** Tail number / set number, when known. */
  registration?: string;
  /** Cabin, class of service, seat category… */
  cabin?: string;
  note?: string;
  /** Minutes against the schedule. Negative is early. */
  departureDelayMinutes?: number;
  arrivalDelayMinutes?: number;
  /**
   * Booked but not travelled — an oversold flight given up, a cancelled leg.
   * Shown struck through and excluded from every derived figure.
   */
  dropped?: boolean;
}

/** A place the journey passes through, in itinerary order. */
export interface Stop {
  placeId: string;
  /** What happened here — "Departure", "Onsen retreat", "Temples & culture". */
  label?: string;
}

export interface Journey {
  id: string;
  slug: string;
  title: string;
  /** A region this journey is better known by, when one fits. */
  label?: string;
  /** One-line positioning under the title. */
  subtitle?: string;
  /** ISO date. */
  startDate: string;
  endDate: string;
  status: JourneyStatus;
  /** The collection this journey is mostly about. */
  collectionId?: string;
  /**
   * Every collection it belongs to — a Hong Kong trip that carried on to
   * Seoul is in both. The primary one comes first.
   */
  collectionIds?: string[];
  heroImage?: string;
  thumbnail?: string;
  /** Long-form travel note. */
  notes?: string;
  highlights: string[];
  stops: Stop[];
  segments: Segment[];
  /**
   * Places that were only ever connections on this journey — the airport
   * counts, the city does not.
   */
  transferPlaceIds?: string[];
}

export interface Collection {
  id: string;
  title: string;
  blurb?: string;
  image?: string;
  /** Material Symbols glyph name. */
  icon?: string;
}

/** Shape of `src/data/journeys.json`. */
export interface AtlasData {
  places: Place[];
  collections: Collection[];
  journeys: Journey[];
}

/** Everything the UI shows about a journey that is *derived*, never authored. */
export interface JourneyMetrics {
  days: number;
  segmentCount: number;
  flightCount: number;
  cityCount: number;
  countryCount: number;
  distanceKm: number;
  /** Sum of segment durations, when known. */
  durationMinutes: number;
  modes: TransportMode[];
}

export interface AtlasMetrics {
  journeyCount: number;
  completedCount: number;
  plannedCount: number;
  distanceKm: number;
  flightCount: number;
  segmentCount: number;
  cityCount: number;
  countryCount: number;
  airportCount: number;
  operatorCount: number;
  vehicleCount: number;
  years: number[];
  modeTotals: Record<TransportMode, number>;
}
