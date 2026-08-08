import { supabase } from './supabase';
import type { Place } from '../types/journey';

/**
 * A place the built atlas does not have.
 *
 * Everything else here can be undone by deleting a row; a place cannot,
 * quite — legs may point at it. Removing one is therefore left to the
 * repository, where the consequences are visible in a diff.
 */
export interface AddedPlace extends Place {
  /** Where the position came from. Not optional: an unsourced coordinate is a guess. */
  source: string;
}

export async function listPlaceAdditions(): Promise<AddedPlace[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('place_additions')
    .select('id, name, code, airport_name, country, country_code, lat, lon, kind, source');
  // The table arrives with migration 007.
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    code: (row.code as string | null) ?? undefined,
    airportName: (row.airport_name as string | null) ?? undefined,
    country: row.country as string,
    countryCode: row.country_code as string,
    lat: row.lat as number,
    lon: row.lon as number,
    kind: (row.kind as 'landscape' | null) ?? undefined,
    source: row.source as string,
  }));
}

export async function writePlace(place: AddedPlace): Promise<string | null> {
  if (!supabase) return 'Supabase is not configured for this site.';

  const { error } = await supabase.from('place_additions').upsert(
    {
      id: place.id,
      name: place.name.trim(),
      code: place.code?.trim() || null,
      airport_name: place.airportName?.trim() || null,
      country: place.country.trim(),
      country_code: place.countryCode.trim().toUpperCase(),
      lat: place.lat,
      lon: place.lon,
      kind: place.kind ?? null,
      source: place.source.trim(),
    },
    { onConflict: 'id' },
  );
  return error ? error.message : null;
}

/** One row of the vendored airport list. Kept short: it ships to the browser. */
export interface ReferenceAirport {
  c: string;
  n: string;
  m: string;
  y: string;
  lat: number;
  lon: number;
}

/**
 * The airport list, fetched only when somebody opens the form.
 *
 * Four thousand airports is a hundred and twenty kilobytes compressed —
 * nothing to a person adding a flight, and a waste for everybody else, so
 * it is not part of the page.
 */
let cached: Promise<ReferenceAirport[]> | null = null;

export function loadAirports(): Promise<ReferenceAirport[]> {
  cached ??= import('../data/airports.json').then(
    (module) => module.default as ReferenceAirport[],
  );
  return cached;
}

export function searchAirports(
  all: ReferenceAirport[],
  query: string,
  limit = 8,
): ReferenceAirport[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const hits: ReferenceAirport[] = [];
  for (const airport of all) {
    // An exact code is what somebody typing three letters means.
    const score =
      airport.c.toLowerCase() === q
        ? 0
        : airport.m.toLowerCase().startsWith(q)
          ? 1
          : airport.n.toLowerCase().includes(q) || airport.m.toLowerCase().includes(q)
            ? 2
            : -1;
    if (score < 0) continue;
    hits.push(airport);
    if (score === 0) break;
  }
  return hits
    .sort((a, b) => {
      const rank = (x: ReferenceAirport) =>
        x.c.toLowerCase() === q ? 0 : x.m.toLowerCase().startsWith(q) ? 1 : 2;
      return rank(a) - rank(b) || a.c.localeCompare(b.c);
    })
    .slice(0, limit);
}

/**
 * Country names come from the browser rather than a vendored list: every
 * engine ships the ISO register already, and a copy here would only go out
 * of date.
 */
const REGIONS =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null;

export const countryName = (code: string) => {
  try {
    return REGIONS?.of(code) ?? code;
  } catch {
    return code;
  }
};

/** Turn a row of the reference list into a place the atlas can hold. */
export function placeFrom(airport: ReferenceAirport): AddedPlace {
  return {
    id: airport.c.toLowerCase(),
    name: airport.m || airport.n,
    code: airport.c,
    airportName: airport.n,
    country: countryName(airport.y),
    countryCode: airport.y,
    lat: airport.lat,
    lon: airport.lon,
    source: 'OurAirports, public domain',
  };
}
