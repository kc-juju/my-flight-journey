import type { Place, Stop } from '../../types/journey';

interface TimelineProps {
  stops: Stop[];
  placesById: Map<string, Place>;
  /** `panel` is the slide-in list; `path` is the sidebar "Journey Path". */
  variant?: 'panel' | 'path';
}

/** Ordered list of places a journey passes through. */
export function Timeline({ stops, placesById, variant = 'panel' }: TimelineProps) {
  if (!stops.length) {
    return (
      <p className="font-body-md text-sm italic text-on-surface-variant">
        No itinerary recorded for this journey.
      </p>
    );
  }

  if (variant === 'path') {
    return (
      <ol className="relative pl-6">
        <span
          aria-hidden
          className="absolute bottom-2 left-[11px] top-2 w-[2px] bg-outline-variant/50"
        />
        {stops.map((stop, index) => {
          const place = placesById.get(stop.placeId);
          const edge = index === 0 || index === stops.length - 1;
          return (
            <li key={`${stop.placeId}-${index}`} className="group relative mb-stack-md last:mb-0">
              <span
                aria-hidden
                className={`absolute -left-[30px] top-1 z-10 h-4 w-4 rounded-full border-2 border-surface-container-lowest shadow-sm transition-transform group-hover:scale-125 ${
                  edge ? 'bg-tertiary-fixed-dim' : 'bg-primary'
                }`}
              />
              <h4 className="font-body-lg font-bold leading-tight text-on-surface">
                {place?.name ?? stop.placeId}
                {place?.code ? ` (${place.code})` : ''}
              </h4>
              <span className="mt-1 block font-label-caps text-label-caps uppercase text-on-surface-variant">
                {stop.label ?? place?.country ?? ''}
              </span>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <ol className="flex flex-col gap-0">
      {stops.map((stop, index) => {
        const place = placesById.get(stop.placeId);
        const isLast = index === stops.length - 1;
        return (
          <li key={`${stop.placeId}-${index}`} className="relative flex gap-4">
            {!isLast && (
              <span
                aria-hidden
                className="absolute bottom-0 left-1.5 top-6 z-0 -ml-px w-0.5 bg-outline-variant/40"
              />
            )}
            <span
              aria-hidden
              className="relative z-10 mt-1.5 h-3 w-3 shrink-0 rounded-full border-2 border-surface bg-tertiary-fixed-dim"
            />
            <div className="pb-6">
              <div className="mb-1 font-headline-md text-[18px] leading-none text-on-surface">
                {place?.name ?? stop.placeId}
              </div>
              <div className="text-sm text-on-surface-variant">
                {stop.label ?? place?.country ?? ''}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
