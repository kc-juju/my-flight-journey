import type { Journey, Place, Segment } from '../types/journey';
import { travelled } from './atlas';

/**
 * Where a photo belongs in an itinerary, and how its timestamp was read.
 *
 * A camera writes `DateTimeOriginal` as a naive local clock. Only newer
 * devices add `OffsetTimeOriginal`. Without an offset the same string means
 * different instants depending on where the photographer was standing — which
 * this atlas happens to know, because the itinerary says where they were.
 */
export interface PhotoPlacement {
  /** Index in the travelled-segment list this photo sits *after*. -1 = before the first leg. */
  afterSegmentIndex: number;
  /** True when the moment falls inside a leg rather than between two. */
  duringSegment: boolean;
  /** Place whose local clock was used to read the timestamp. */
  place?: Place;
  /** How the instant was determined. */
  basis: 'exif-offset' | 'itinerary' | 'unplaced';
  /** Resolved instant, ISO with offset, when it could be determined. */
  instant?: string;
}

const HOUR = 3_600_000;

/** Minutes that a zone is offset from UTC at a given instant. */
export function zoneOffsetMinutes(timeZone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(at).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  );
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === '24' ? '00' : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUTC - at.getTime()) / 60_000);
}

/** Interpret a naive local date-time ("2025-10-06T14:03") in a named zone. */
export function localToInstant(naive: string, timeZone: string): Date {
  const guess = new Date(`${naive}Z`);
  // Two passes settle DST boundaries.
  let offset = zoneOffsetMinutes(timeZone, guess);
  let instant = new Date(guess.getTime() - offset * 60_000);
  offset = zoneOffsetMinutes(timeZone, instant);
  instant = new Date(guess.getTime() - offset * 60_000);
  return instant;
}

interface Anchor {
  segment: Segment;
  index: number;
  fromZone?: string;
  toZone?: string;
  departure?: Date;
  arrival?: Date;
}

function anchors(journey: Journey, placesById: Map<string, Place>): Anchor[] {
  return travelled(journey).map((segment, index) => {
    const from = placesById.get(segment.fromPlaceId);
    const to = placesById.get(segment.toPlaceId);
    const fromZone = from?.timezone;
    const toZone = to?.timezone;
    return {
      segment,
      index,
      fromZone,
      toZone,
      departure:
        segment.departure?.includes('T') && fromZone
          ? localToInstant(segment.departure, fromZone)
          : undefined,
      arrival:
        segment.arrival?.includes('T') && toZone
          ? localToInstant(segment.arrival, toZone)
          : undefined,
    };
  });
}

/**
 * Place a photo in the itinerary.
 *
 * With an EXIF offset the instant is known outright. Without one, each stay is
 * tested in its own local clock: "was the traveller in Vancouver when their
 * camera said 14:03?" — which is the only reading that does not assume the
 * photographer's phone was set to Taipei time.
 */
export function placePhoto(
  journey: Journey,
  placesById: Map<string, Place>,
  taken: { naiveLocal?: string; offsetMinutes?: number | null },
): PhotoPlacement {
  const legs = anchors(journey, placesById);
  if (!taken.naiveLocal || !legs.length) {
    return { afterSegmentIndex: legs.length - 1, duringSegment: false, basis: 'unplaced' };
  }

  // ---- exact instant, when the camera recorded its offset -----------------
  if (taken.offsetMinutes != null) {
    const instant = new Date(
      new Date(`${taken.naiveLocal}Z`).getTime() - taken.offsetMinutes * 60_000,
    );
    return {
      ...byInstant(legs, instant, placesById),
      basis: 'exif-offset',
      instant: instant.toISOString(),
    };
  }

  // ---- no offset: read the clock where the traveller actually was ---------
  for (let i = 0; i < legs.length; i += 1) {
    const leg = legs[i];
    const next = legs[i + 1];

    // In the air / on the road: compare in the departure zone.
    if (leg.departure && leg.arrival && leg.fromZone) {
      const asLocal = localToInstant(taken.naiveLocal, leg.fromZone);
      if (asLocal >= leg.departure && asLocal <= leg.arrival) {
        return {
          afterSegmentIndex: i,
          duringSegment: true,
          place: placesById.get(leg.segment.fromPlaceId),
          basis: 'itinerary',
          instant: asLocal.toISOString(),
        };
      }
    }

    // Staying somewhere: from this arrival until the next departure.
    const stayZone = leg.toZone;
    const stayStart = leg.arrival;
    const stayEnd = next?.departure;
    if (stayZone && stayStart) {
      const asLocal = localToInstant(taken.naiveLocal, stayZone);
      if (asLocal >= stayStart && (!stayEnd || asLocal <= stayEnd)) {
        return {
          afterSegmentIndex: i,
          duringSegment: false,
          place: placesById.get(leg.segment.toPlaceId),
          basis: 'itinerary',
          instant: asLocal.toISOString(),
        };
      }
    }
  }

  // Before the first departure, or outside the journey entirely.
  const first = legs[0];
  if (first?.departure && first.fromZone) {
    const asLocal = localToInstant(taken.naiveLocal, first.fromZone);
    if (asLocal < first.departure) {
      return {
        afterSegmentIndex: -1,
        duringSegment: false,
        place: placesById.get(first.segment.fromPlaceId),
        basis: 'itinerary',
        instant: asLocal.toISOString(),
      };
    }
  }
  return { afterSegmentIndex: legs.length - 1, duringSegment: false, basis: 'unplaced' };
}

function byInstant(
  legs: Anchor[],
  instant: Date,
  placesById: Map<string, Place>,
): Omit<PhotoPlacement, 'basis' | 'instant'> {
  for (let i = 0; i < legs.length; i += 1) {
    const leg = legs[i];
    const next = legs[i + 1];
    if (leg.departure && leg.arrival && instant >= leg.departure && instant <= leg.arrival) {
      return {
        afterSegmentIndex: i,
        duringSegment: true,
        place: placesById.get(leg.segment.fromPlaceId),
      };
    }
    if (leg.arrival && instant >= leg.arrival && (!next?.departure || instant <= next.departure)) {
      return {
        afterSegmentIndex: i,
        duringSegment: false,
        place: placesById.get(leg.segment.toPlaceId),
      };
    }
    if (leg.departure && instant < leg.departure) {
      return {
        afterSegmentIndex: i - 1,
        duringSegment: false,
        place: placesById.get(leg.segment.fromPlaceId),
      };
    }
  }
  return { afterSegmentIndex: legs.length - 1, duringSegment: false };
}

/** Human summary of how a photo's time was worked out. */
export function basisLabel(placement: PhotoPlacement): string {
  switch (placement.basis) {
    case 'exif-offset':
      return 'Time zone read from the photo';
    case 'itinerary':
      return placement.place?.timezone
        ? `Read as ${placement.place.timezone} — where you were`
        : 'Placed from the itinerary';
    default:
      return 'Could not be placed — added at the end';
  }
}

export const MS_PER_HOUR = HOUR;
