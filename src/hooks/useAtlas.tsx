import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import raw from '../data/journeys.json';
import type { AtlasData, Journey, JourneyMetrics, Place } from '../types/journey';
import { atlasMetrics, indexPlaces, journeyMetrics, sortByDateDesc } from '../lib/atlas';
import { listOverrides, setOverride, type Overrides } from '../lib/titles';

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
}

const AtlasContext = createContext<AtlasContextValue | null>(null);

export function AtlasProvider({ children }: { children: ReactNode }) {
  // Titles the owner has overruled. They live in Supabase rather than the
  // build so a rename survives the next rebuild and everyone sees it.
  const [overrides, setOverrides] = useState<Overrides>({});

  useEffect(() => {
    let live = true;
    void listOverrides().then((rows) => {
      if (live) setOverrides(rows);
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

  const value = useMemo<AtlasContextValue>(() => {
    const placesById = indexPlaces(data.places);
    const journeys = [...data.journeys]
      .map((journey) => {
        const over = overrides[journey.slug];
        if (!over) return journey;
        return {
          ...journey,
          // A hand-written title also stands in for the region label, so the
          // collection lists call the journey what its owner calls it.
          ...(over.title ? { title: over.title, label: over.title } : {}),
          ...(over.note ? { notes: over.note } : {}),
        };
      })
      .sort(sortByDateDesc);
    const cache = new Map<string, JourneyMetrics>();

    return {
      data,
      placesById,
      journeys,
      metrics: atlasMetrics(data),
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
    };
  }, [overrides, edit]);

  return <AtlasContext.Provider value={value}>{children}</AtlasContext.Provider>;
}

export function useAtlas(): AtlasContextValue {
  const ctx = useContext(AtlasContext);
  if (!ctx) throw new Error('useAtlas must be used inside <AtlasProvider>');
  return ctx;
}
