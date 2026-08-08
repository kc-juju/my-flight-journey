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
}

const AtlasContext = createContext<AtlasContextValue | null>(null);

export function AtlasProvider({ children }: { children: ReactNode }) {
  // Titles the owner has overruled. They live in Supabase rather than the
  // build so a rename survives the next rebuild and everyone sees it.
  const [overrides, setOverrides] = useState<Overrides>({});
  // Schedule changes to legs that have not been flown yet. Same reasoning:
  // an airline moves a flight long after the log was built.
  const [changes, setChanges] = useState<SegmentChanges>({});

  useEffect(() => {
    let live = true;
    void listOverrides().then((rows) => {
      if (live) setOverrides(rows);
    });
    void listSegmentChanges().then((rows) => {
      if (live) setChanges(rows);
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

  const value = useMemo<AtlasContextValue>(() => {
    const placesById = indexPlaces(data.places);
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
        if (!over && !retimed) return journey;
        return {
          ...journey,
          ...(retimed ? { segments } : {}),
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
    const corrected: AtlasData = { ...data, journeys };

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
    };
  }, [overrides, edit, changes, editSegment]);

  return <AtlasContext.Provider value={value}>{children}</AtlasContext.Provider>;
}

export function useAtlas(): AtlasContextValue {
  const ctx = useContext(AtlasContext);
  if (!ctx) throw new Error('useAtlas must be used inside <AtlasProvider>');
  return ctx;
}
