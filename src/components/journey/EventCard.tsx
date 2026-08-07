import type { JourneyEvent, Place } from '../../types/journey';
import { formatDayDate } from '../../lib/format';
import { sportOf } from '../../lib/sports';
import { Icon } from '../ui/Icon';

/**
 * Something that happened on the journey without anybody moving.
 *
 * The itinerary is otherwise a list of departures, which describes how a trip
 * was spent but never why it was taken. A match sits in the same column as
 * the trains that reached it, drawn differently so it does not read as one.
 */
export function EventCard({
  event,
  placesById,
}: {
  event: JourneyEvent;
  placesById: Map<string, Place>;
}) {
  const at = placesById.get(event.placeId);
  const sport = sportOf(event.kind);

  return (
    <article className="flex items-start gap-4 rounded-xl border border-dashed border-tertiary-fixed-dim/60 bg-tertiary-fixed-dim/5 p-stack-sm">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-tertiary-fixed-dim/15">
        <Icon name={sport?.icon ?? 'local_activity'} className="text-[22px] text-primary" />
      </span>

      <div className="flex min-w-0 flex-col">
        <span className="font-label-caps text-label-caps uppercase tracking-widest text-tertiary-fixed-dim">
          {sport?.label ?? 'On the day'}
          {at && ` · ${at.name}`}
        </span>

        <h4 className="font-headline-md text-[17px] leading-tight text-on-surface">
          {event.title}
        </h4>

        {event.detail && (
          <span className="mt-0.5 font-body-md text-sm text-on-surface-variant">
            {event.detail}
          </span>
        )}

        <span className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
          <span className="text-on-surface">{formatDayDate(event.date)}</span>
          {event.time && <span>{event.time} local</span>}
          {event.source && <span className="text-on-surface-variant/70">{event.source}</span>}
        </span>
      </div>
    </article>
  );
}
