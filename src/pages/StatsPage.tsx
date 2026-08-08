import { Link } from 'react-router-dom';
import { useAtlas } from '../hooks/useAtlas';
import { ImageCredits } from '../components/stats/ImageCredits';
import { Breakdowns } from '../components/stats/Breakdowns';
import { EarthLaps } from '../components/stats/EarthLaps';
import { Icon } from '../components/ui/Icon';
import { formatNumber, MODE_ICON, MODE_LABEL } from '../lib/format';
import { asset } from '../lib/asset';

/** Fixed angles, cycled — a scrapbook is never square, but it is never random
 *  between one visit and the next either. */
const TILTS = ['tilt-1', 'tilt-2', 'tilt-4', 'tilt-3'];

export function StatsPage() {
  const { metrics, data, journeys } = useAtlas();

  return (
    <div className="mx-auto flex w-full max-w-container flex-col gap-margin-desktop px-margin-mobile py-stack-lg lg:px-margin-desktop">
      <section className="flex flex-col gap-stack-lg">
        <header className="flex flex-col gap-unit">
          <h1 className="font-display-lg text-display-lg-mobile tracking-tight text-on-surface md:text-display-lg">
            The metrics of memory
          </h1>
          <p className="max-w-lg font-body-md text-on-surface-variant">
            Every number here is derived from the journey log — nothing is typed in by hand.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-gutter md:grid-cols-12">
          {/* The distance sheet: the largest thing on the page, taped down. */}
          <article className="paper tape tilt-3 flex flex-col p-stack-md md:col-span-8">
            <div className="flex items-start justify-between gap-4">
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
                Total distance
              </span>
              <Icon name="public" className="opacity-40 text-on-surface-variant" />
            </div>

            <div className="mt-stack-md flex items-baseline gap-2">
              <span className="font-display-lg text-display-lg leading-none text-primary">
                {formatNumber(metrics.distanceKm)}
              </span>
              <span className="font-headline-md text-headline-md text-on-surface-variant">km</span>
            </div>

            <EarthLaps km={metrics.distanceKm} />
          </article>

          {/* Two counts cut out with scissors rather than drawn as cards. */}
          <div className="flex items-center justify-center gap-2 md:col-span-4 md:-ml-6 md:flex-col md:items-center md:gap-0">
            <div className="blob tilt-2 flex w-[172px] flex-col items-center justify-center bg-primary-container text-on-primary shadow-lg">
              <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-primary/70">
                Countries
              </span>
              <span className="font-display-lg text-display-lg leading-none">
                {metrics.countryCount}
              </span>
              <Icon name="map" className="mt-1 text-[16px] text-on-primary/60" />
            </div>

            <div className="blob-alt tilt-1 flex w-[150px] flex-col items-center justify-center bg-tertiary-fixed-dim text-on-tertiary-fixed shadow-lg md:-mt-5 md:ml-16">
              <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-tertiary-fixed/70">
                Cities
              </span>
              <span className="font-display-lg text-display-lg leading-none">
                {metrics.cityCount}
              </span>
              <Icon name="location_city" className="mt-1 text-[16px] text-on-tertiary-fixed/60" />
            </div>
          </div>

          {/* The log itself: older stock, torn off at the foot, and stamped. */}
          <article className="paper paper--aged paper--torn tilt-2 relative flex flex-col p-stack-md pb-stack-lg md:col-span-11 md:-mt-6">
            <span
              aria-hidden
              className="stamp absolute right-6 top-6 rounded px-3 py-1 font-label-caps text-[13px] uppercase"
            >
              Verified
            </span>

            <div className="flex items-baseline gap-3">
              <span className="font-display-lg text-display-lg leading-none text-primary">
                {metrics.journeyCount}
              </span>
              <span className="font-headline-md text-headline-md italic text-on-surface-variant">
                journeys documented
              </span>
            </div>

            <div className="mt-stack-md grid grid-cols-2 gap-gutter sm:grid-cols-4">
              <MiniStat label="Segments" value={metrics.segmentCount} />
              <MiniStat label="Airports / stations" value={metrics.airportCount} />
              <MiniStat label="Operators" value={metrics.operatorCount} />
              <MiniStat label="Vehicle types" value={metrics.vehicleCount} />
            </div>
          </article>

          <section className="paper tilt-1 flex flex-col gap-stack-md p-stack-md md:col-span-12">
            <div className="flex items-center gap-2">
              <Icon name="alt_route" className="text-on-surface-variant" />
              <h2 className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
                How the ground was covered
              </h2>
            </div>
            <ul className="grid grid-cols-2 gap-gutter sm:grid-cols-3 lg:grid-cols-6">
              {Object.entries(metrics.modeTotals)
                .filter(([, n]) => n > 0)
                .map(([mode, n]) => (
                  <li
                    key={mode}
                    className="flex flex-col gap-1 border-l-2 border-tertiary-fixed-dim/60 pl-3"
                  >
                    <Icon
                      name={MODE_ICON[mode as keyof typeof MODE_ICON]}
                      className="text-[22px] text-on-surface-variant"
                    />
                    <span className="font-headline-md text-[20px] text-primary">{n}</span>
                    <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
                      {MODE_LABEL[mode as keyof typeof MODE_LABEL]}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        </div>
      </section>

      <Breakdowns />

      <section className="flex flex-col gap-stack-md">
        <header className="flex flex-col gap-unit">
          <h2 className="font-headline-md text-[22px] leading-tight text-on-surface">
            Curated experiences
          </h2>
          <p className="max-w-lg font-body-md text-sm text-on-surface-variant">
            Shortcuts into the journey list, grouped by region.
          </p>
        </header>

        {/* A rail of doors into the journey list, not a gallery. The full
            cards said the same thing at five times the height, and the
            journeys page already filters by these very collections. */}
        <div className="atlas-rail flex snap-x gap-gutter overflow-x-auto px-2 pb-4 pt-4">
          {data.collections.map((collection, i) => {
            const inCollection = journeys.filter((j) =>
              (j.collectionIds ?? [j.collectionId]).includes(collection.id),
            );
            return (
              <Link
                key={collection.id}
                to={`/journeys?collection=${collection.id}`}
                className={`polaroid tape-single tape ${TILTS[i % TILTS.length]} relative flex w-[186px] shrink-0 snap-start flex-col`}
              >
                <span
                  aria-hidden
                  className="block h-[132px] w-full bg-cover bg-center"
                  style={
                    collection.image
                      ? { backgroundImage: `url('${asset(collection.image)}')` }
                      : { backgroundColor: 'rgb(43 38 32 / 0.08)' }
                  }
                />
                <span className="flex flex-col items-center gap-0.5 px-2 py-3 text-center">
                  <span className="font-headline-md text-[15px] leading-tight text-on-surface">
                    {collection.title}
                  </span>
                  <span className="font-label-caps text-[9px] uppercase tracking-widest text-on-surface-variant">
                    {inCollection.length} {inCollection.length === 1 ? 'journey' : 'journeys'}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <ImageCredits />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col border-t-2 border-dotted border-on-surface-variant/30 pt-2">
      <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
        {label}
      </span>
      <span className="mt-0.5 font-headline-md text-headline-md text-primary">{value}</span>
    </div>
  );
}
