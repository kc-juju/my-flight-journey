import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import raw from '../data/journeys.json';
import type { AtlasData, Journey, JourneyMetrics, Place } from '../types/journey';
import { atlasMetrics, indexPlaces, journeyMetrics, sortByDateDesc } from '../lib/atlas';
import { listTitles, setTitle, type TitleOverrides } from '../lib/titles';

const data = raw as unknown as AtlasData;

interface AtlasContextValue {
  data: AtlasData;
  placesById: Map<string, Place>;
  journeys: Journey[];
  metrics: ReturnType<typeof atlasMetrics>;
  metricsFor: (journey: Journey) => JourneyMetrics;
  journeyBySlug: (slug: string) => Journey | undefined;
  /** Rename a journey, or pass '' to go back to the generated title. */
  renameJourney: (slug: string, title: string) => Promise<string | null>;
}

const AtlasContext = createContext<AtlasContextValue | null>(null);

export function AtlasProvider({ children }: { children: ReactNode }) {
  // Titles the owner has overruled. They live in Supabase rather than the
  // build so a rename survives the next rebuild and everyone sees it.
  const [overrides, setOverrides] = useState<TitleOverrides>({});

  useEffect(() => {
    let live = true;
    void listTitles().then((rows) => {
      if (live) setOverrides(rows);
    });
    return () => {
      live = false;
    };
  }, []);

  const rename = useCallback(async (slug: string, title: string) => {
    const error = await setTitle(slug, title);
    if (error) return error;
    setOverrides((current) => {
      const next = { ...current };
      const wanted = title.trim();
      if (wanted) next[slug] = wanted;
      else delete next[slug];
      return next;
    });
    return null;
  }, []);

  const value = useMemo<AtlasContextValue>(() => {
    const placesById = indexPlaces(data.places);
    const journeys = [...data.journeys]
      .map((journey) => {
        const title = overrides[journey.slug];
        // A hand-written title also stands in for the region label, so the
        // collection lists call the journey what its owner calls it.
        return title ? { ...journey, title, label: title } : journey;
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
      renameJourney: rename,
    };
  }, [overrides, rename]);

  return <AtlasContext.Provider value={value}>{children}</AtlasContext.Provider>;
}

export function useAtlas(): AtlasContextValue {
  const ctx = useContext(AtlasContext);
  if (!ctx) throw new Error('useAtlas must be used inside <AtlasProvider>');
  return ctx;
}
