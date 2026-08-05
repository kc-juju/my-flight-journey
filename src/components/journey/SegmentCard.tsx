import type { Place, Segment } from '../../types/journey';
import {
  dayOffset,
  formatClock,
  formatDayDate,
  formatDuration,
  MODE_COLOR,
  MODE_ICON,
  MODE_LABEL,
} from '../../lib/format';
import { Icon } from '../ui/Icon';

interface SegmentCardProps {
  segment: Segment;
  placesById: Map<string, Place>;
}

/** One leg of the itinerary — flight, train, ferry, whatever it was. */
export function SegmentCard({ segment, placesById }: SegmentCardProps) {
  const from = placesById.get(segment.fromPlaceId);
  const to = placesById.get(segment.toPlaceId);
  const accent = MODE_COLOR[segment.mode];

  const heading = [MODE_LABEL[segment.mode].toUpperCase(), segment.reference]
    .filter(Boolean)
    .join(' • ');

  const overnight = dayOffset(segment.departure, segment.arrival);
  const dropped = Boolean(segment.dropped);
  // A date without a "T" means only the day was recorded; no clock to show.
  const hasClock = Boolean(segment.departure?.includes('T') && segment.arrival);

  const detail = [segment.operator, segment.cabin, segment.vehicle, segment.note]
    .filter(Boolean)
    .join(' • ');

  return (
    <article
      className={`group relative flex flex-col items-start gap-stack-md overflow-hidden rounded-xl p-stack-md transition-shadow duration-300 md:flex-row md:items-center ${
        dropped
          ? 'border border-dashed border-outline-variant bg-surface-container-low/60 shadow-none'
          : 'bg-surface-container-lowest shadow-md shadow-primary/5 hover:shadow-lg'
      }`}
    >
      <span
        aria-hidden
        className="absolute bottom-0 left-0 top-0 w-1"
        style={{ background: dropped ? 'transparent' : accent }}
      />

      <div
        className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full transition-transform ${
          dropped
            ? 'bg-surface-container text-on-surface-variant/50'
            : 'bg-surface-container text-primary group-hover:scale-110'
        }`}
      >
        <Icon
          name={dropped ? 'flight_class' : MODE_ICON[segment.mode]}
          className="text-[32px]"
        />
      </div>

      <div className="flex w-full flex-grow flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex flex-col">
          <span
            className="mb-1 flex flex-wrap items-center gap-2 font-label-caps text-label-caps uppercase"
            style={{ color: dropped ? undefined : accent }}
          >
            <span className={dropped ? 'text-on-surface-variant/70 line-through' : ''}>
              {heading}
            </span>
            {dropped && (
              <span className="rounded-full border border-outline-variant px-2 py-0.5 text-[10px] tracking-widest text-on-surface-variant">
                Not flown
              </span>
            )}
          </span>

          <div
            className={`flex flex-wrap items-baseline gap-2 ${
              dropped ? 'text-on-surface-variant/60 line-through decoration-2' : ''
            }`}
          >
            <h4 className="font-headline-md text-headline-md">
              {from?.airportName ?? from?.name ?? segment.fromPlaceId}
            </h4>
            <Icon name="arrow_right_alt" className="text-[16px] no-underline" />
            <h4 className="font-headline-md text-headline-md">
              {to?.airportName ?? to?.name ?? segment.toPlaceId}
            </h4>
          </div>

          {detail && (
            <span className="mt-1 font-body-md text-sm text-on-surface-variant">{detail}</span>
          )}

          {segment.departure && (
            <span className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
              <span className="text-on-surface">{formatDayDate(segment.departure)}</span>
              {hasClock && (
                <>
                  <span>
                    {formatClock(segment.departure)} → {formatClock(segment.arrival)}
                    {overnight > 0 && (
                      <sup className="ml-0.5 text-tertiary-fixed-dim">+{overnight}</sup>
                    )}
                    {' local'}
                  </span>
                  {overnight > 0 && (
                    <span className="text-on-surface-variant/70">
                      arrives {formatDayDate(segment.arrival)}
                    </span>
                  )}
                </>
              )}
            </span>
          )}
        </div>

        <div className="shrink-0 text-left md:text-right">
          {dropped ? (
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              Given up
            </span>
          ) : (
            <>
              <span
                className="block font-stat-display text-stat-display"
                style={{ color: accent }}
              >
                {formatDuration(segment.durationMinutes ?? 0)}
              </span>
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                Duration
              </span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
