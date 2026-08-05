import { createContext, useContext, useMemo, type ReactNode } from 'react';
import raw from '../data/journeys.json';
import type { AtlasData, Journey, JourneyMetrics, Place } from '../types/journey';
import { atlasMetrics, indexPlaces, journeyMetrics, sortByDateDesc } from '../lib/atlas';

const data = raw as unknown as AtlasData;

interface AtlasContextValue {
  data: AtlasData;
  placesById: Map<string, Place>;
  journeys: Journey[];
  metrics: ReturnType<typeof atlasMetrics>;
  metricsFor: (journey: Journey) => JourneyMetrics;
  journeyBySlug: (slug: string) => Journey | undefined;
}

const AtlasContext = createContext<AtlasContextValue | null>(null);

export function AtlasProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AtlasContextValue>(() => {
    const placesById = indexPlaces(data.places);
    const journeys = [...data.journeys].sort(sortByDateDesc);
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
    };
  }, []);

  return <AtlasContext.Provider value={value}>{children}</AtlasContext.Provider>;
}

export function useAtlas(): AtlasContextValue {
  const ctx = useContext(AtlasContext);
  if (!ctx) throw new Error('useAtlas must be used inside <AtlasProvider>');
  return ctx;
}
