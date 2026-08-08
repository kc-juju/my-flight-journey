import { supabase } from './supabase';
import type { Segment, TransportMode } from '../types/journey';

/**
 * A leg added after the build — one the flight log never had.
 *
 * Where it goes is written by place id, the same ids the built atlas uses,
 * so an addition can only point at somewhere the atlas already knows.
 */
export interface AddedSegment {
  segmentId: string;
  mode: TransportMode;
  fromPlaceId: string;
  toPlaceId: string;
  departure?: string;
  arrival?: string;
  reference?: string;
  operator?: string;
  vehicle?: string;
  cabin?: string;
  note?: string;
}

/** Added legs, grouped by the journey they belong to. */
export type Additions = Record<string, AddedSegment[]>;

/** Legs written here are marked, so nobody mistakes one for a flown record. */
export const ADDED_PREFIX = 'added-';

export function newSegmentId(from: string, to: string, at: number): string {
  return `${ADDED_PREFIX}${at}-${from}-${to}`;
}

export const isAdded = (segmentId: string) => segmentId.startsWith(ADDED_PREFIX);

const ROW = 'journey_slug, segment_id, mode, from_place_id, to_place_id, departure, arrival, reference, operator, vehicle, cabin, note';

export async function listAdditions(): Promise<Additions> {
  if (!supabase) return {};

  const { data, error } = await supabase.from('segment_additions').select(ROW);
  // The table arrives with migration 006. Until it is run, the site shows
  // exactly what the build produced.
  if (error || !data) return {};

  const out: Additions = {};
  for (const row of data) {
    const slug = row.journey_slug as string;
    (out[slug] ??= []).push({
      segmentId: row.segment_id as string,
      mode: (row.mode as TransportMode) ?? 'flight',
      fromPlaceId: row.from_place_id as string,
      toPlaceId: row.to_place_id as string,
      departure: (row.departure as string | null) ?? undefined,
      arrival: (row.arrival as string | null) ?? undefined,
      reference: (row.reference as string | null) ?? undefined,
      operator: (row.operator as string | null) ?? undefined,
      vehicle: (row.vehicle as string | null) ?? undefined,
      cabin: (row.cabin as string | null) ?? undefined,
      note: (row.note as string | null) ?? undefined,
    });
  }
  return out;
}

export async function writeAddition(slug: string, leg: AddedSegment): Promise<string | null> {
  if (!supabase) return 'Supabase is not configured for this site.';

  const { error } = await supabase.from('segment_additions').upsert(
    {
      journey_slug: slug,
      segment_id: leg.segmentId,
      mode: leg.mode,
      from_place_id: leg.fromPlaceId,
      to_place_id: leg.toPlaceId,
      departure: leg.departure?.trim() || null,
      arrival: leg.arrival?.trim() || null,
      reference: leg.reference?.trim() || null,
      operator: leg.operator?.trim() || null,
      vehicle: leg.vehicle?.trim() || null,
      cabin: leg.cabin?.trim() || null,
      note: leg.note?.trim() || null,
    },
    { onConflict: 'journey_slug,segment_id' },
  );
  return error ? error.message : null;
}

export async function removeAddition(slug: string, segmentId: string): Promise<string | null> {
  if (!supabase) return 'Supabase is not configured for this site.';
  const { error } = await supabase
    .from('segment_additions')
    .delete()
    .eq('journey_slug', slug)
    .eq('segment_id', segmentId);
  return error ? error.message : null;
}

/**
 * Turn an added leg into a segment, and put it where its clock says it goes.
 *
 * Both ends are local to their own place, so the duration is only computed
 * when the atlas can say what the offset between them is; where it cannot,
 * the leg simply carries no length rather than a wrong one.
 */
export function toSegment(leg: AddedSegment, offsetMinutes?: number): Segment {
  const gap =
    leg.departure && leg.arrival
      ? Math.round(
          (Date.parse(`${leg.arrival}:00Z`) - Date.parse(`${leg.departure}:00Z`)) / 60_000,
        )
      : undefined;
  const minutes =
    gap === undefined ? undefined : gap + (offsetMinutes ?? 0);

  return {
    id: leg.segmentId,
    mode: leg.mode,
    fromPlaceId: leg.fromPlaceId,
    toPlaceId: leg.toPlaceId,
    ...(leg.departure ? { departure: leg.departure } : {}),
    ...(leg.arrival ? { arrival: leg.arrival } : {}),
    ...(minutes !== undefined && minutes > 0 ? { durationMinutes: minutes } : {}),
    ...(leg.reference ? { reference: leg.reference } : {}),
    ...(leg.operator ? { operator: leg.operator } : {}),
    ...(leg.vehicle ? { vehicle: leg.vehicle } : {}),
    ...(leg.cabin ? { cabin: leg.cabin } : {}),
    ...(leg.note ? { note: leg.note } : {}),
  };
}

/**
 * Minutes to add to a clock-face difference between two places.
 *
 * Recovered from a leg the build already measured between the same pair: the
 * gap between its recorded duration and the difference of its own two local
 * times is the offset between the zones. Nothing is assumed when the atlas
 * has never flown that pair — the leg keeps no duration instead.
 */
export function zoneOffsets(segments: Segment[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const segment of segments) {
    if (!segment.departure?.includes('T') || !segment.arrival?.includes('T')) continue;
    if (segment.durationMinutes === undefined) continue;
    const clock =
      (Date.parse(`${segment.arrival}:00Z`) - Date.parse(`${segment.departure}:00Z`)) / 60_000;
    out.set(`${segment.fromPlaceId}>${segment.toPlaceId}`, segment.durationMinutes - clock);
  }
  return out;
}
