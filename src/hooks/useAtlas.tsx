import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import raw from '../data/journeys.json';
import type { AtlasData, Journey, JourneyMetrics, Place } from '../types/journey';
import { atlasMetrics, indexPlaces, journeyMetrics, sortByDateDesc } from '../lib/atlas';
import { listOverrides, setOverride, type Overrides } from '../lib/titles';
import {
  applyChange, changeKey, listSegmentChanges, writeSegmentChange,
  type SegmentChange, type SegmentChanges,
} from '../lib/segment-changes';
import {
  listAdditions, removeAddition, toSegment, writeAddition, zoneOffsets,
  type AddedSegment, type Additions,
} from '../lib/segment-additions';
import {
  listPlaceAdditions, writePlace, type AddedPlace,
} from '../lib/place-additions';

const data = raw as unknown as AtlasData;

interface AtlasContextValue {
  data: AtlasData;
  placesById: Map<string, Place>;
  journeys: Journey[];
  metrics: ReturnType<typeof atlasMetrics>;
  metricsFor: (journey: Journey) => JourneyMetrics;
  journeyBySlug: (slug: string) => Journey | undefined;
  /**
   * Write a journey's title or its note. Passing '' clears that field, and
   * clearing both returns the journey to what the build generated.
   */
  editJourney: (slug: string, field: 'title' | 'note', value: string) => Promise<string | null>;
  /** What has been written over the generated text for this journey. */
  overrideFor: (slug: string) => { title?: string; note?: string } | undefined;
  /**
   * Record what an airline did to a booked leg. Passing an empty change
   * undoes the correction and the flight log stands again.
   */
  editSegment: (slug: string, segmentId: string, change: SegmentChange) => Promise<string | null>;
  /** The correction laid over this leg, if any. */
  changeFor: (slug: string, segmentId: string) => SegmentChange | undefined;
  /** Put a leg the flight log never had into a journey. */
  addSegment: (slug: string, leg: AddedSegment) => Promise<string | null>;
  /** Take an added leg out again. Only added legs can be removed this way. */
  dropSegment: (slug: string, segmentId: string) => Promise<string | null>;
  /** Teach the atlas somewhere it has never been, so a leg can point at it. */
  addPlace: (place: AddedPlace) => Promise<string | null>;
}

const AtlasContext = createContext<AtlasContextValue | null>(null);

export function AtlasProvider({ children }: { children: ReactNode }) {
  // Titles the owner has overruled. They live in Supabase rather than the
  // build so a rename survives the next rebuild and everyone sees it.
  const [overrides, setOverrides] = useState<Overrides>({});
  // Schedule changes to legs that have not been flown yet. Same reasoning:
  // an airline moves a flight long after the log was built.
  const [changes, setChanges] = useState<SegmentChanges>({});
  // Legs added by hand: a positioning flight, a replacement the airline put
  // you on, a train the log cannot see.
  const [additions, setAdditions] = useState<Additions>({});
  // Places the build has never seen — the destinations of journeys still
  // being planned.
  const [extraPlaces, setExtraPlaces] = useState<AddedPlace[]>([]);

  useEffect(() => {
    let live = true;
    void listOverrides().then((rows) => {
      if (live) setOverrides(rows);
    });
    void listSegmentChanges().then((rows) => {
      if (live) setChanges(rows);
    });
    void listAdditions().then((rows) => {
      if (live) setAdditions(rows);
    });
    void listPlaceAdditions().then((rows) => {
      if (live) setExtraPlaces(rows);
    });
    return () => {
      live = false;
    };
  }, []);

  const edit = useCallback(
    async (slug: string, field: 'title' | 'note', value: string) => {
      const error = await setOverride(slug, field, value, overrides[slug]);
      if (error) return error;
      setOverrides((current) => {
        const next = { ...current };
        const row = { ...next[slug], [field]: value.trim() || undefined };
        if (!row.title && !row.note) delete next[slug];
        else next[slug] = row;
        return next;
      });
      return null;
    },
    [overrides],
  );

  const editSegment = useCallback(
    async (slug: string, segmentId: string, change: SegmentChange) => {
      const error = await writeSegmentChange(slug, segmentId, change);
      if (error) return error;
      setChanges((current) => {
        const next = { ...current };
        const key = changeKey(slug, segmentId);
        const kept = Object.fromEntries(
          Object.entries(change).filter(([, v]) => v !== undefined && v !== '' && v !== false),
        );
        if (Object.keys(kept).length === 0) delete next[key];
        else next[key] = kept;
        return next;
      });
      return null;
    },
    [],
  );

  const addSegment = useCallback(async (slug: string, leg: AddedSegment) => {
    const error = await writeAddition(slug, leg);
    if (error) return error;
    setAdditions((current) => {
      const rest = (current[slug] ?? []).filter((l) => l.segmentId !== leg.segmentId);
      return { ...current, [slug]: [...rest, leg] };
    });
    return null;
  }, []);

  const dropSegment = useCallback(async (slug: string, segmentId: string) => {
    const error = await removeAddition(slug, segmentId);
    if (error) return error;
    setAdditions((current) => ({
      ...current,
      [slug]: (current[slug] ?? []).filter((l) => l.segmentId !== segmentId),
    }));
    return null;
  }, []);

  const addPlace = useCallback(async (place: AddedPlace) => {
    const error = await writePlace(place);
    if (error) return error;
    setExtraPlaces((current) => [
      ...current.filter((p) => p.id !== place.id),
      place,
    ]);
    return null;
  }, []);

  const value = useMemo<AtlasContextValue>(() => {
    // A place added from the site is indistinguishable downstream from one
    // the build produced, except that the build never overwrites it.
    const known = new Set(data.places.map((p) => p.id));
    const places = [...data.places, ...extraPlaces.filter((p) => !known.has(p.id))];
    const placesById = indexPlaces(places);
    const journeys = [...data.journeys]
      .map((journey) => {
        const over = overrides[journey.slug];
        // Corrections are laid over the segments before anything is measured,
        // so a moved flight moves the distance, the duration and the stats
        // with it rather than only the line on the card.
        const segments = journey.segments.map((segment) =>
          applyChange(segment, changes[changeKey(journey.slug, segment.id)]),
        );
        const retimed = segments.some((s, i) => s !== journey.segments[i]);
        // Added legs sort themselves into the itinerary by their departure,
        // so nothing has to say where they belong. A leg with no clock goes
        // to the end rather than to the start of the trip.
        const extra = additions[journey.slug] ?? [];
        const offsets = extra.length ? zoneOffsets(journey.segments) : null;
        const all = extra.length
          ? [
              ...segments,
              ...extra.map((leg) =>
                toSegment(leg, offsets?.get(`${leg.fromPlaceId}>${leg.toPlaceId}`)),
              ),
            ].sort((a, b) => (a.departure ?? '9999').localeCompare(b.departure ?? '9999'))
          : segments;
        if (!over && !retimed && !extra.length) return journey;
        return {
          ...journey,
          ...(retimed || extra.length ? { segments: all } : {}),
          // A hand-written title also stands in for the region label, so the
          // collection lists call the journey what its owner calls it.
          ...(over.title ? { title: over.title, label: over.title } : {}),
          ...(over.note ? { notes: over.note } : {}),
        };
      })
      .sort(sortByDateDesc);
    const cache = new Map<string, JourneyMetrics>();
    // Everything downstream — the totals, the breakdowns, the map — reads
    // from here, so a correction reaches all of them rather than only the
    // card it was typed into.
    const corrected: AtlasData = { ...data, journeys, places };

    return {
      data: corrected,
      placesById,
      journeys,
      metrics: atlasMetrics(corrected),
      metricsFor: (journey) => {
        const hit = cache.get(journey.id);
        if (hit) return hit;
        const computed = journeyMetrics(journey, placesById);
        cache.set(journey.id, computed);
        return computed;
      },
      journeyBySlug: (slug) => journeys.find((j) => j.slug === slug),
      editJourney: edit,
      overrideFor: (slug: string) => overrides[slug],
      editSegment,
      changeFor: (slug: string, segmentId: string) => changes[changeKey(slug, segmentId)],
      addSegment,
      dropSegment,
      addPlace,
    };
  }, [
    overrides, edit, changes, editSegment, additions, addSegment, dropSegment,
    extraPlaces, addPlace,
  ]);

  return <AtlasContext.Provider value={value}>{children}</AtlasContext.Provider>;
}

export function useAtlas(): AtlasContextValue {
  const ctx = useContext(AtlasContext);
  if (!ctx) throw new Error('useAtlas must be used inside <AtlasProvider>');
  return ctx;
}
