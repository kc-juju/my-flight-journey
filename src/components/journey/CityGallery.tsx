import { motion } from 'framer-motion';
import type { Journey, Place } from '../../types/journey';
import { placesOfJourney } from '../../lib/atlas';
import { asset } from '../../lib/asset';
import { Icon } from '../ui/Icon';

interface CityGalleryProps {
  journey: Journey;
  placesById: Map<string, Place>;
}

/**
 * Every city the journey touched, in itinerary order.
 * One place can appear twice in a route (home at both ends) — show it once.
 */
export function CityGallery({ journey, placesById }: CityGalleryProps) {
  const places = placesOfJourney(journey, placesById);
  if (!places.length) return null;

  return (
    <section className="flex flex-col gap-stack-md">
      <h2 className="px-2 font-headline-md text-headline-md text-on-surface">
        Cities on this journey
      </h2>

      <ul className="grid grid-cols-2 gap-gutter sm:grid-cols-3">
        {places.map((place, index) => (
          <motion.li
            key={place.id}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3), ease: 'easeOut' }}
            className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-container shadow-md"
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
                <h3 className="font-display-lg text-[20px] leading-tight text-on-primary drop-shadow">
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
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
