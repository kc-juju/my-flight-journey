import { Link } from 'react-router-dom';
import { useAtlas } from '../hooks/useAtlas';
import { ImageCredits } from '../components/stats/ImageCredits';
import { Breakdowns } from '../components/stats/Breakdowns';
import { EarthLaps } from '../components/stats/EarthLaps';
import { Icon } from '../components/ui/Icon';
import { formatNumber, MODE_ICON, MODE_LABEL } from '../lib/format';
import { asset } from '../lib/asset';

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
          <article className="flex flex-col rounded-xl bg-surface-container-lowest p-stack-md shadow-sm md:col-span-8">
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

          <div className="grid grid-cols-2 gap-gutter md:col-span-4 md:grid-cols-1">
            <div className="flex flex-col justify-center rounded-xl bg-primary-container p-stack-md text-on-primary shadow-sm">
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-primary/70">
                Countries
              </span>
              <span className="font-display-lg text-display-lg leading-none">
                {metrics.countryCount}
              </span>
              <Icon name="map" className="mt-1 text-[16px] text-on-primary/60" />
            </div>

            <div className="flex flex-col justify-center rounded-xl bg-surface-container-lowest p-stack-md shadow-sm">
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
                Cities
              </span>
              <span className="font-display-lg text-display-lg leading-none text-primary">
                {metrics.cityCount}
              </span>
              <Icon name="location_city" className="mt-1 text-[16px] text-on-surface-variant/60" />
            </div>
          </div>

          <article className="flex flex-col rounded-xl bg-surface-container p-stack-md md:col-span-12">
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

          <section className="flex flex-col gap-stack-md rounded-xl bg-surface-container-lowest p-stack-md shadow-sm md:col-span-12">
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
          {data.collections.map((collection) => {
            const inCollection = journeys.filter((j) =>
              (j.collectionIds ?? [j.collectionId]).includes(collection.id),
            );
            return (
              <Link
                key={collection.id}
                to={`/journeys?collection=${collection.id}`}
                className="polaroid relative flex w-[186px] shrink-0 snap-start flex-col transition-transform duration-300 hover:-translate-y-1"
              >
                <span
                  aria-hidden
                  className="block h-[132px] w-full bg-cover bg-center"
                  style={
                    collection.image
                      ? { backgroundImage: `url('${asset(collection.image)}')` }
                      : { backgroundColor: 'rgb(17 28 44 / 0.08)' }
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
