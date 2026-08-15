import type { JourneyEvent, Place } from '../../types/journey';
import { formatDayDate, formatDuration } from '../../lib/format';
import { sportOf } from '../../lib/sports';
import { EVENT_TONE, PARK_TONE, SPORT_TONE } from '../../lib/palette';
import { Icon } from '../ui/Icon';
import { MickeyEars } from '../ui/MickeyEars';

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
  const disney = event.kind === 'disney';
  // Every match is the same kind of evening out; parks are not a match.
  const tone = disney ? PARK_TONE : sport ? SPORT_TONE : EVENT_TONE;
  // Both ends are local clock times at the same place, so the difference is
  // simply how long the day lasted.
  const spanMinutes =
    event.from && event.to
      ? (Number(event.to.slice(0, 2)) * 60 + Number(event.to.slice(3, 5))) -
        (Number(event.from.slice(0, 2)) * 60 + Number(event.from.slice(3, 5)))
      : null;

  return (
    <article
      className="flex items-start gap-4 rounded-xl border border-dashed p-stack-sm"
      style={{ backgroundColor: tone.tint, borderColor: tone.edge }}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-container-lowest"
        style={{ color: tone.accent }}
      >
        {disney ? (
          <MickeyEars className="h-6 w-6" />
        ) : (
          <Icon name={sport?.icon ?? 'local_activity'} className="text-[22px]" />
        )}
      </span>

      <div className="flex min-w-0 flex-col">
        <span
          className="font-label-caps text-label-caps uppercase tracking-widest"
          style={{ color: tone.accent }}
        >
          {sport?.label ?? (disney ? 'Park day' : 'On the day')}
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
          {event.from && event.to && (
            <>
              <span>
                {event.from} → {event.to} local
              </span>
              {spanMinutes !== null && spanMinutes > 0 && (
                <span className="text-on-surface">{formatDuration(spanMinutes)} in the park</span>
              )}
            </>
          )}
          {event.source && <span className="text-on-surface-variant/70">{event.source}</span>}
        </span>
      </div>
    </article>
  );
}
