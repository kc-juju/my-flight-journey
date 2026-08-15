import type { ReactNode } from 'react';

/**
 * The line an itinerary is threaded on.
 *
 * Every row of a journey — a leg, a wait, an evening at a ground, a base with
 * days branching off it — draws its own piece of one continuous route down
 * the left gutter. Collecting that here rather than repeating the markup at
 * each call site is what makes it a route: four hand-copied versions drift,
 * and a line that drifts by two pixels stops reading as one line.
 *
 * Anything added later — a new mode, a new kind of event — gets the route by
 * wrapping itself in this, and gets it right by construction.
 */
export type SpineKind =
  /** Moved: a solid stretch in the leg's own colour. */
  | 'travelled'
  /** Stayed put but something happened: the line dots without breaking. */
  | 'paused'
  /** Waiting — a connection, a night, a week: a hairline, no colour claimed. */
  | 'waiting';

export interface RouteSpineProps {
  /** The colour this stretch is drawn in. Ignored when waiting. */
  colour?: string;
  kind?: SpineKind;
  /** A hollow ring on the line, or nothing where a row is a continuation. */
  node?: 'stop' | 'base' | 'none';
  /** Where the ring sits, measured to match the row's first line of text. */
  nodeTop?: number;
  className?: string;
  children: ReactNode;
}

/** The gutter's width, and the line's place in it. Everything else measures
 *  from these two numbers. */
export const SPINE_GUTTER = 40;
const LINE_X = 15;
const LINE_W = 2;

export function RouteSpine({
  colour = '#a2957a',
  kind = 'travelled',
  node = 'stop',
  nodeTop = 28,
  className = '',
  children,
}: RouteSpineProps) {
  const line =
    kind === 'waiting'
      ? { backgroundColor: '#d6cbb2' }
      : kind === 'paused'
        ? {
            backgroundImage:
              `repeating-linear-gradient(to bottom, ${colour} 0 5px, transparent 5px 10px)`,
          }
        : { backgroundColor: colour };

  const ring = kind === 'waiting' ? '#a2957a' : colour;

  return (
    <div className={`relative ${className}`} style={{ paddingLeft: SPINE_GUTTER }}>
      <span
        aria-hidden
        className="absolute bottom-0 top-0"
        style={{ left: LINE_X, width: LINE_W, ...line }}
      />

      {node !== 'none' && (
        <span
          aria-hidden
          className="absolute rounded-full border-[3px] bg-surface-warm"
          style={{
            left: node === 'base' ? LINE_X - 8 : LINE_X - 6,
            top: nodeTop,
            height: node === 'base' ? 18 : 14,
            width: node === 'base' ? 18 : 14,
            borderColor: ring,
          }}
        />
      )}

      {children}
    </div>
  );
}
