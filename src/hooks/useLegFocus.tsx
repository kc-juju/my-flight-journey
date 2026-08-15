import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Which leg the reader is pointing at.
 *
 * The itinerary and the map are two drawings of the same journey, and until
 * now neither knew the other existed: you could read that the third leg was
 * Hong Kong to Los Angeles without ever seeing which of the lines on the map
 * that was.
 *
 * Kept as context rather than passed down because the two ends are far apart
 * in the tree — a card deep in the itinerary and a polyline inside a Leaflet
 * container — and because anything added later gets the behaviour by being
 * rendered inside the provider, not by being wired to it.
 */
interface LegFocus {
  focused: string | null;
  focus: (segmentId: string | null) => void;
}

const NOWHERE: LegFocus = { focused: null, focus: () => {} };

const LegFocusContext = createContext<LegFocus>(NOWHERE);

export function LegFocusProvider({ children }: { children: ReactNode }) {
  const [focused, setFocused] = useState<string | null>(null);
  const value = useMemo<LegFocus>(() => ({ focused, focus: setFocused }), [focused]);
  return <LegFocusContext.Provider value={value}>{children}</LegFocusContext.Provider>;
}

/**
 * Outside a provider this is inert, so a card can be rendered anywhere — a
 * list, a preview, a test — without needing one.
 */
export function useLegFocus(): LegFocus {
  return useContext(LegFocusContext);
}
