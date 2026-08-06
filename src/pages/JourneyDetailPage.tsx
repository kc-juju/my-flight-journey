import { Fragment } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAtlas } from '../hooks/useAtlas';
import { WorldMap } from '../components/map/WorldMap';
import { Timeline } from '../components/journey/Timeline';
import { SegmentCard } from '../components/journey/SegmentCard';
import { CityGallery } from '../components/journey/CityGallery';
import { Guestbook } from '../components/guestbook/Guestbook';
import { HeroCarousel } from '../components/journey/HeroCarousel';
import {
  PhotoStrip,
  PhotoUploader,
  usePhotoSlots,
} from '../components/journey/JourneyPhotos';
import { citiesOfJourney, layoverMinutes } from '../lib/atlas';
import { Icon } from '../components/ui/Icon';
import { formatDateRange, formatDuration, formatNumber, STATUS_LABEL } from '../lib/format';

export function JourneyDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { journeyBySlug, placesById, metricsFor } = useAtlas();
  const journey = slug ? journeyBySlug(slug) : undefined;

  if (!journey) {
    return (
      <div className="mx-auto flex max-w-container flex-col items-start gap-stack-md px-margin-mobile py-margin-desktop lg:px-margin-desktop">
        <h1 className="font-display-lg text-headline-md text-on-surface">Journey not found</h1>
        <p className="font-body-md text-on-surface-variant">
          No journey matches “{slug}”.
        </p>
        <Link
          to="/journeys"
          className="rounded-full bg-primary px-6 py-3 font-label-caps text-label-caps uppercase text-on-primary"
        >
          Back to all journeys
        </Link>
      </div>
    );
  }

  const metrics = metricsFor(journey);
  // Same rule as the gallery: home appears on every journey, so it is not a
  // photo worth showing. Fall back to everything for a purely domestic hop.
  const all = citiesOfJourney(journey, placesById);
  const away = all.filter((p) => !p.home);
  const heroPlaces = away.length ? away : all;

  // Photos are filed against the list of legs that actually happened, so a
  // dropped leg must not shift the index the strips are keyed by.
  const { slots: photoSlots, refresh: refreshPhotos } = usePhotoSlots(journey, placesById);
  const photosBefore = photoSlots.get(-1) ?? [];
  const travelledIndex = (renderedIndex: number) =>
    journey.segments.slice(0, renderedIndex + 1).filter((s) => !s.dropped).length - 1;

  return (
    <div className="flex w-full flex-col pb-margin-desktop">
      <section className="relative mx-auto -mt-20 w-full max-w-container px-0 pt-20 md:px-margin-mobile lg:px-margin-desktop">
        <HeroCarousel
          places={heroPlaces}
          className="h-[60vh] max-h-[700px] min-h-[400px] w-full shadow-2xl shadow-primary/5 md:rounded-xl"
        >
          <div className="absolute bottom-0 left-0 z-10 flex w-full flex-col justify-end p-stack-lg">
            <div className="mb-stack-sm flex flex-wrap items-center gap-stack-sm">
              <span className="rounded-full border border-surface-container-lowest/30 bg-surface/20 px-3 py-1 font-label-caps text-label-caps uppercase text-on-primary backdrop-blur-md">
                {STATUS_LABEL[journey.status]}
              </span>
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-primary/80">
                {formatDateRange(journey.startDate, journey.endDate)}
              </span>
            </div>
            <h1 className="mb-2 font-display-lg text-display-lg-mobile text-on-primary drop-shadow-lg md:text-display-lg">
              {journey.title}
            </h1>
            <p className="max-w-2xl font-body-md text-lg text-on-primary/80 drop-shadow-md">
              {metrics.days} days • {metrics.cityCount} cities • {metrics.countryCount} countries
              • {formatNumber(metrics.distanceKm)} km
            </p>
          </div>
        </HeroCarousel>
      </section>

      <div className="relative z-10 mx-auto mt-stack-lg grid w-full max-w-container grid-cols-1 gap-stack-lg px-margin-mobile lg:grid-cols-12 lg:px-margin-desktop">
        <div className="flex flex-col gap-stack-lg lg:col-span-8">
          {journey.notes && (
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5 }}
              className="group relative overflow-hidden rounded-xl bg-surface-container-lowest p-stack-lg shadow-lg shadow-primary/5"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -mr-16 -mt-16 right-0 top-0 h-32 w-32 rounded-bl-full bg-tertiary-fixed-dim/20 blur-3xl"
              />
              <h2 className="mb-stack-md flex items-center gap-3 font-headline-md text-headline-md text-on-surface">
                <Icon name="menu_book" filled className="text-[24px] text-tertiary-fixed-dim" />
                Travel notes
              </h2>
              <p className="font-body-lg leading-relaxed text-on-surface-variant first-letter:float-left first-letter:mr-3 first-letter:font-display-lg first-letter:text-5xl first-letter:text-primary">
                {journey.notes}
              </p>

              {journey.highlights.length > 0 && (
                <div className="mt-stack-lg flex flex-wrap gap-stack-sm border-t border-surface-variant pt-stack-md">
                  <span className="mb-2 w-full font-label-caps text-label-caps uppercase tracking-widest text-primary">
                    Highlights
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {journey.highlights.map((h) => (
                      <span
                        key={h}
                        className="cursor-default rounded-full bg-surface-container px-4 py-2 font-body-md text-sm text-on-surface transition-colors hover:bg-surface-container-high"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.article>
          )}

          <CityGallery journey={journey} placesById={placesById} />

          <section className="flex flex-col gap-stack-md">
            <h2 className="px-2 font-headline-md text-headline-md text-on-surface">
              Itinerary segments
            </h2>
            {photosBefore.length > 0 && (
              <PhotoStrip photos={photosBefore} onDeleted={refreshPhotos} />
            )}
            {journey.segments.map((segment, index) => {
              const next = journey.segments[index + 1];
              const wait =
                next && !segment.dropped && !next.dropped
                  ? layoverMinutes(segment, next, placesById)
                  : null;
              const at = placesById.get(segment.toPlaceId);
              // A short gap is a connection whatever else happened; whether the
              // city counts is a separate question, and one stop can differ
              // from another at the same airport on the same trip.
              const isShort = wait !== null && wait < 12 * 60;
              const notCounted = (journey.transferPlaceIds ?? []).includes(
                segment.toPlaceId,
              );
              return (
              <Fragment key={segment.id}>
                <SegmentCard segment={segment} placesById={placesById} />
                {(photoSlots.get(travelledIndex(index)) ?? []).length > 0 && (
                  <PhotoStrip
                    photos={photoSlots.get(travelledIndex(index)) ?? []}
                    onDeleted={refreshPhotos}
                  />
                )}

                {wait !== null && (
                  <p className="flex flex-wrap items-center gap-2 px-2 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
                    <Icon
                      name={isShort ? 'connecting_airports' : 'hotel'}
                      className="text-[16px]"
                    />
                    {formatDuration(wait)} {isShort ? 'connecting in' : 'in'}{' '}
                    {at?.name ?? ''}
                    {notCounted && (
                      <span className="rounded-full border border-outline-variant px-2 py-0.5 text-[9px]">
                        Not counted as a visit
                      </span>
                    )}
                  </p>
                )}
              </Fragment>
              );
            })}
            <p className="px-2 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
              Total travelling time {formatDuration(metrics.durationMinutes)} ·{' '}
              {formatNumber(metrics.distanceKm)} km great-circle
            </p>

            <PhotoUploader
              journey={journey}
              placesById={placesById}
              onUploaded={refreshPhotos}
            />

            <Guestbook journeySlug={journey.slug} variant="inline" />
          </section>
        </div>

        <aside className="flex flex-col gap-stack-lg lg:col-span-4">
          <div className="rounded-xl bg-surface-container-lowest p-stack-lg shadow-lg shadow-primary/5">
            <h2 className="mb-stack-md font-headline-md text-headline-md text-on-surface">
              Journey path
            </h2>
            <Timeline stops={journey.stops} placesById={placesById} variant="path" />
          </div>

          <div className="overflow-hidden rounded-xl bg-surface-container-lowest p-2 shadow-lg shadow-primary/5">
            <div className="h-64 w-full overflow-hidden rounded-lg md:h-80">
              <WorldMap
                journeys={[journey]}
                placesById={placesById}
                activeId={journey.id}
                focus={journey}
                focusPlaces={heroPlaces}
                scrollWheelZoom={false}
                zoom={4}
              />
            </div>
          </div>

          <Link
            to="/journeys"
            className="flex items-center justify-center gap-2 rounded-full border border-outline-variant px-6 py-3 font-label-caps text-label-caps uppercase text-on-surface transition-colors hover:bg-surface-container"
          >
            <Icon name="arrow_back" className="text-[16px]" />
            All journeys
          </Link>
        </aside>
      </div>
    </div>
  );
}
