import { useCallback, useEffect, useRef, useState } from 'react';
import type { Journey, Place } from '../../types/journey';
import { placesOfJourney } from '../../lib/atlas';
import { asset } from '../../lib/asset';
import { Icon } from '../ui/Icon';

interface CityGalleryProps {
  journey: Journey;
  placesById: Map<string, Place>;
}

/**
 * The cities a journey reached, as a carousel.
 *
 * Home is skipped — every journey starts and ends there, so showing it says
 * nothing. If a journey reached nowhere else (a domestic hop), show what
 * there is rather than an empty rail.
 */
export function CityGallery({ journey, placesById }: CityGalleryProps) {
  const all = placesOfJourney(journey, placesById);
  const away = all.filter((p) => !p.home);
  const places = away.length ? away : all;

  const rail = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const measure = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    measure();
    const el = rail.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, places.length]);

  const scrollBy = (direction: -1 | 1) => {
    const el = rail.current;
    if (!el) return;
    // Advance by one card plus its gap.
    const card = el.querySelector('li');
    const step = card ? card.clientWidth + 24 : el.clientWidth * 0.8;
    el.scrollBy({ left: step * direction, behavior: 'smooth' });
  };

  if (!places.length) return null;

  return (
    <section className="flex flex-col gap-stack-md">
      <div className="flex items-end justify-between gap-4 px-2">
        <h2 className="font-headline-md text-headline-md text-on-surface">
          Cities on this journey
        </h2>

        <div className="flex items-center gap-2">
          <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
            {places.length}
          </span>
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            disabled={atStart}
            aria-label="Previous cities"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant text-on-surface transition-colors hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Icon name="chevron_left" className="text-[20px]" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            disabled={atEnd}
            aria-label="More cities"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant text-on-surface transition-colors hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Icon name="chevron_right" className="text-[20px]" />
          </button>
        </div>
      </div>

      <ul
        ref={rail}
        onScroll={measure}
        className="flex snap-x snap-mandatory gap-gutter overflow-x-auto scroll-smooth pb-2"
      >
        {places.map((place) => (
          <li
            key={place.id}
            className="group relative aspect-[4/3] w-[260px] shrink-0 snap-start overflow-hidden rounded-xl bg-surface-container shadow-md sm:w-[300px]"
          >
            {place.image ? (
              <img
                src={asset(place.image)}
                alt={`${place.name}, ${place.country}`}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Icon name="photo_camera" className="text-[28px] text-on-surface-variant/40" />
              </div>
            )}

            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-primary/85 via-primary/20 to-transparent"
            />

            <div className="absolute bottom-0 left-0 w-full p-stack-sm">
              <div className="flex items-baseline gap-2">
                <h3 className="font-display-lg text-[22px] leading-tight text-on-primary drop-shadow">
                  {place.name}
                </h3>
                {place.code && (
                  <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-primary/70">
                    {place.code}
                  </span>
                )}
              </div>
              <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-primary/70">
                {place.country}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
