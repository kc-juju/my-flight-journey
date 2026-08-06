import { AnimatePresence, motion } from 'framer-motion';
import type { Journey, JourneyMetrics } from '../../types/journey';
import { formatMonthYear, formatNumber, plural } from '../../lib/format';
import { asset } from '../../lib/asset';

interface JourneyPopupProps {
  journey: Journey | null;
  metrics: JourneyMetrics | null;
  /** Viewport coordinates of the pointer. */
  position: { x: number; y: number } | null;
}

/**
 * The floating card that follows the cursor over a route.
 * Purely presentational — the map owns hover state.
 */
export function JourneyPopup({ journey, metrics, position }: JourneyPopupProps) {
  const visible = Boolean(journey && metrics && position);

  const stats = metrics
    ? [
        { label: 'Duration', value: plural(metrics.days, 'day') },
        { label: 'Flights', value: String(metrics.flightCount) },
        { label: 'Cities', value: String(metrics.cityCount) },
        { label: 'Distance', value: `${formatNumber(metrics.distanceKm)} km` },
      ]
    : [];

  return (
    <AnimatePresence>
      {visible && journey && position && (
        <motion.aside
          key={journey.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="pointer-events-none fixed z-[1100] w-80 rounded-xl border border-outline-variant/30 bg-surface/95 p-4 shadow-2xl backdrop-blur-md"
          style={{
            left: Math.min(Math.max(position.x + 18, 16), window.innerWidth - 336),
            top: Math.min(Math.max(position.y - 40, 96), window.innerHeight - 380),
          }}
          role="status"
        >
          {journey.thumbnail && (
            <div className="mb-4 h-32 w-full overflow-hidden rounded-lg shadow-sm">
              <img
                src={asset(journey.thumbnail)}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          )}

          <div className="mb-2 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-tertiary-fixed-dim" />
            <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
              {formatMonthYear(journey.startDate)}
            </span>
          </div>

          <h3 className="mb-4 font-display-lg text-headline-md leading-tight text-on-surface">
            {journey.title}
          </h3>

          <dl className="mb-4 grid grid-cols-2 gap-4">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="mb-1 font-label-caps text-[10px] uppercase text-on-surface-variant">
                  {s.label}
                </dt>
                <dd className="font-headline-md text-[18px] text-on-surface">{s.value}</dd>
              </div>
            ))}
          </dl>

          {metrics && (
            <p className="text-center font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant opacity-70">
              {formatNumber(metrics.distanceKm)} km · click to explore
            </p>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
