import type { Place, Segment } from '../../types/journey';
import { formatClock, formatDuration, MODE_COLOR, MODE_ICON, MODE_LABEL } from '../../lib/format';
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

  const detail = [segment.operator, segment.cabin, segment.vehicle, segment.note]
    .filter(Boolean)
    .join(' • ');

  return (
    <article className="group relative flex flex-col items-start gap-stack-md overflow-hidden rounded-xl bg-surface-container-lowest p-stack-md shadow-md shadow-primary/5 transition-shadow duration-300 hover:shadow-lg md:flex-row md:items-center">
      <span
        aria-hidden
        className="absolute bottom-0 left-0 top-0 w-1"
        style={{ background: accent }}
      />

      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary transition-transform group-hover:scale-110">
        <Icon name={MODE_ICON[segment.mode]} className="text-[32px]" />
      </div>

      <div className="flex w-full flex-grow flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex flex-col">
          <span
            className="mb-1 font-label-caps text-label-caps uppercase"
            style={{ color: accent }}
          >
            {heading}
          </span>

          <div className="flex flex-wrap items-baseline gap-2">
            <h4 className="font-headline-md text-headline-md text-on-surface">
              {from?.airportName ?? from?.name ?? segment.fromPlaceId}
            </h4>
            <Icon name="arrow_right_alt" className="text-[16px] text-on-surface-variant" />
            <h4 className="font-headline-md text-headline-md text-on-surface">
              {to?.airportName ?? to?.name ?? segment.toPlaceId}
            </h4>
          </div>

          {detail && (
            <span className="mt-1 font-body-md text-sm text-on-surface-variant">{detail}</span>
          )}

          {segment.departure && segment.arrival && (
            <span className="mt-1 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
              {formatClock(segment.departure)} → {formatClock(segment.arrival)} local
            </span>
          )}
        </div>

        <div className="shrink-0 text-left md:text-right">
          <span className="block font-stat-display text-stat-display" style={{ color: accent }}>
            {formatDuration(segment.durationMinutes ?? 0)}
          </span>
          <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
            Duration
          </span>
        </div>
      </div>
    </article>
  );
}
