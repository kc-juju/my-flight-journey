import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Place } from '../../types/journey';
import { asset } from '../../lib/asset';
import { Icon } from '../ui/Icon';

interface HeroCarouselProps {
  /** Slides, in itinerary order. */
  places: Place[];
  /** Title block and anything else that sits over the image. */
  children?: ReactNode;
  /** Milliseconds between automatic advances. */
  interval?: number;
  className?: string;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The journey hero: one photo per city, cycling.
 *
 * Auto-advance pauses on hover and focus, stops entirely when the visitor has
 * asked for reduced motion, and is skipped when there is only one photo.
 */
export function HeroCarousel({
  places,
  children,
  interval = 5000,
  className = '',
}: HeroCarouselProps) {
  const slides = places.filter((p) => p.image);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | null>(null);

  const go = useCallback(
    (next: number) => setIndex(((next % slides.length) + slides.length) % slides.length),
    [slides.length],
  );

  useEffect(() => {
    if (slides.length < 2 || paused || prefersReducedMotion()) return;
    timer.current = window.setTimeout(() => go(index + 1), interval);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [index, paused, slides.length, interval, go]);

  if (!slides.length) {
    return (
      <div className={`relative bg-surface-container ${className}`}>
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-primary/10 to-primary/80" />
        {children}
      </div>
    );
  }

  const current = slides[index];

  return (
    <div
      className={`group relative overflow-hidden ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Photos from this journey"
    >
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 0.9, ease: 'easeInOut' }, scale: { duration: 6, ease: 'linear' } }}
          className="absolute inset-0"
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${asset(current.image)}')` }}
            role="img"
            aria-label={`${current.name}, ${current.country}`}
          />
          {/* The caption lives inside the slide so it can never name the
              outgoing photo while the incoming one is still fading in. */}
          <div className="absolute right-stack-md top-stack-md rounded-full border border-surface-container-lowest/25 bg-primary/35 px-3 py-1 backdrop-blur-md">
            <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-primary">
              {current.name}
            </span>
          </div>
        </motion.div>
      </AnimatePresence>

      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-primary/80"
      />

      {children}

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-primary/30 text-on-primary opacity-0 backdrop-blur-md transition-opacity hover:bg-primary/50 focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Icon name="chevron_left" className="text-[22px]" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-primary/30 text-on-primary opacity-0 backdrop-blur-md transition-opacity hover:bg-primary/50 focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Icon name="chevron_right" className="text-[22px]" />
          </button>

          <div className="absolute bottom-3 right-stack-md z-20 flex gap-1.5">
            {slides.map((place, i) => (
              <button
                key={place.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show ${place.name}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all ${
                  i === index
                    ? 'w-6 bg-tertiary-fixed-dim'
                    : 'w-1.5 bg-surface-container-lowest/60 hover:bg-surface-container-lowest'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
