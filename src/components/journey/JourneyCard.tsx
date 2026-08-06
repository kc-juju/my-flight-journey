import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Journey, JourneyMetrics } from '../../types/journey';
import { formatMonthYear, MODE_ICON, MODE_LABEL, plural, STATUS_LABEL } from '../../lib/format';
import { Icon } from '../ui/Icon';
import { asset } from '../../lib/asset';

interface JourneyCardProps {
  journey: Journey;
  metrics: JourneyMetrics;
  /** `compact` is the sidebar list on the map; `full` is the journeys index. */
  variant?: 'compact' | 'full';
  onHoverStart?: (journey: Journey) => void;
  onHoverEnd?: () => void;
}

export function JourneyCard({
  journey,
  metrics,
  variant = 'compact',
  onHoverStart,
  onHoverEnd,
}: JourneyCardProps) {
  const summary = [
    plural(metrics.days, 'day'),
    plural(metrics.segmentCount, 'leg'),
    plural(metrics.cityCount, 'city', 'cities'),
  ].join(' • ');

  const body = (
    <>
      <div
        className={
          variant === 'compact'
            ? 'h-24 w-24 shrink-0 overflow-hidden rounded-lg shadow-md'
            : 'h-48 w-full overflow-hidden rounded-xl shadow-md'
        }
      >
        {journey.thumbnail ? (
          <img
            src={asset(journey.thumbnail)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-container">
            <Icon name="map" className="text-[28px] text-on-surface-variant/50" />
          </div>
        )}
      </div>

      <div className="flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full bg-tertiary-fixed-dim ${
              journey.status === 'completed' ? '' : 'opacity-50'
            }`}
          />
          <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
            {formatMonthYear(journey.startDate)}
          </span>
          {journey.status !== 'completed' && (
            <span className="rounded-full border border-outline-variant/60 px-2 py-0.5 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
              {STATUS_LABEL[journey.status]}
            </span>
          )}
        </div>

        <h3 className="mb-2 font-display-lg text-[22px] leading-tight text-on-surface transition-colors group-hover:text-on-tertiary-container">
          {journey.title}
        </h3>

        <p className="text-sm text-on-surface-variant">{summary}</p>

        {(journey.collectionIds?.length ?? 0) > 1 && (
          <ul className="mt-2 flex flex-wrap gap-1">
            {journey.collectionIds!.map((id) => (
              <li
                key={id}
                className="rounded-full border border-outline-variant/60 px-2 py-0.5 font-label-caps text-[9px] uppercase tracking-widest text-on-surface-variant"
              >
                {id.replace(/-/g, ' ')}
              </li>
            ))}
          </ul>
        )}

        <ul className="mt-2 flex flex-wrap items-center gap-3">
          {metrics.modes.map((mode) => (
            <li
              key={mode}
              className="flex items-center gap-1 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant"
            >
              <Icon name={MODE_ICON[mode]} className="text-[14px]" />
              {MODE_LABEL[mode]}
            </li>
          ))}
        </ul>
      </div>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      onHoverStart={() => onHoverStart?.(journey)}
      onHoverEnd={() => onHoverEnd?.()}
    >
      <Link
        to={`/journeys/${journey.slug}`}
        className={`group flex cursor-pointer gap-4 ${
          variant === 'compact' ? 'items-start' : 'flex-col'
        }`}
      >
        {body}
      </Link>
    </motion.div>
  );
}
