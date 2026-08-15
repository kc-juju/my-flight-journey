import type { TransportMode } from '../types/journey';

/**
 * A colour per kind of thing, so the page can be read without reading it.
 *
 * Every leg used to sit on the same white card with a hairline of colour down
 * one edge, which meant a coach and a flight were told apart only by their
 * label. Here each kind carries a hue through its whole card — the rule, the
 * icon plate, and the ground under it.
 *
 * The discipline that keeps this from becoming a paintbox: the accents are
 * saturated and the grounds are not. Every `tint` sits at roughly the same
 * lightness and a fraction of the chroma, so a page of mixed legs still reads
 * as one warm surface with things arranged on it, rather than as stripes.
 * All of them are drawn from the same aged-map family the atlas already uses
 * — ochre, sage, terracotta, slate — not from a spectrum.
 */
export interface Tone {
  /** The rule, the icon, the one saturated moment. */
  accent: string;
  /** The ground the card sits on. Low chroma, high lightness. */
  tint: string;
  /** A hairline that belongs to the same hue. */
  edge: string;
}

export const MODE_TONE: Record<TransportMode, Tone> = {
  // Ochre — the atlas's own gold, kept for the thing it does most.
  flight: { accent: '#b8860b', tint: '#f9f2e0', edge: '#e6d3a8' },
  // Sage, for rails.
  train: { accent: '#5c7355', tint: '#eef2ea', edge: '#c6d3bf' },
  // Terracotta, for roads.
  car: { accent: '#a3603d', tint: '#f8ece5', edge: '#e2c3b0' },
  // Slate teal, for coaches.
  bus: { accent: '#3f6f75', tint: '#e9f1f2', edge: '#bcd4d7' },
  // Deep blue, for water.
  ferry: { accent: '#3a5a7a', tint: '#eaeff5', edge: '#bfcedd' },
  // Warm grey, for the parts done on foot.
  walk: { accent: '#6f6757', tint: '#f2efe8', edge: '#d3ccbc' },
  // The legs the log cannot describe stay deliberately colourless.
  surface: { accent: '#8d8271', tint: '#f3f0ea', edge: '#d8d1c3' },
};

/**
 * Grounds and parks.
 *
 * Every sport shares one tone: they are the same kind of evening out, and
 * giving baseball and basketball separate colours would say they differ in
 * some way that matters. Park days keep their own blue, because they are the
 * one thing here that is not a match.
 */
export const SPORT_TONE: Tone = { accent: '#4f6b3f', tint: '#eef2e8', edge: '#c8d6bc' };
export const PARK_TONE: Tone = { accent: '#3a6ea8', tint: '#e9f0f7', edge: '#bfd3e6' };
export const EVENT_TONE: Tone = { accent: '#8a6a1f', tint: '#f7f1e2', edge: '#ddcfae' };

/** The colour a mode draws with on the map, where there is no card to tint. */
export const MODE_ACCENT: Record<TransportMode, string> = Object.fromEntries(
  Object.entries(MODE_TONE).map(([mode, tone]) => [mode, tone.accent]),
) as Record<TransportMode, string>;
