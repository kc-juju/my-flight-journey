import { Link } from 'react-router-dom';
import { useAtlas } from '../hooks/useAtlas';
import { StatisticsCard } from '../components/stats/StatisticsCard';
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
          <StatisticsCard
            label="Total distance"
            value={formatNumber(metrics.distanceKm)}
            unit="km"
            icon="public"
            className="md:col-span-8"
          >
            <EarthLaps km={metrics.distanceKm} />
          </StatisticsCard>

          <div className="grid grid-cols-1 gap-gutter md:col-span-4">
            <StatisticsCard
              label="Countries"
              value={metrics.countryCount}
              icon="map"
              tone="inverted"
            />
            <StatisticsCard label="Cities" value={metrics.cityCount} icon="location_city" />
          </div>

          <StatisticsCard
            label="Journey log"
            value={metrics.journeyCount}
            unit="journeys"
            icon="explore"
            tone="muted"
            className="md:col-span-12"
          >
            <div className="mt-stack-md grid grid-cols-1 gap-gutter sm:grid-cols-4">
              <MiniStat label="Segments" value={metrics.segmentCount} />
              <MiniStat label="Airports / stations" value={metrics.airportCount} />
              <MiniStat label="Operators" value={metrics.operatorCount} />
              <MiniStat label="Vehicle types" value={metrics.vehicleCount} />
            </div>
          </StatisticsCard>

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
                    className="flex flex-col gap-1 rounded-lg bg-surface-container p-stack-sm"
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
        <div className="atlas-rail flex snap-x gap-gutter overflow-x-auto pb-2">
          {data.collections.map((collection) => {
            const inCollection = journeys.filter((j) =>
              (j.collectionIds ?? [j.collectionId]).includes(collection.id),
            );
            return (
              <Link
                key={collection.id}
                to={`/journeys?collection=${collection.id}`}
                className="group relative flex h-[132px] w-[228px] shrink-0 snap-start flex-col justify-end overflow-hidden rounded-xl bg-surface-container-lowest shadow-md transition-transform duration-300 hover:-translate-y-1"
              >
                {collection.image && (
                  <div
                    aria-hidden
                    className="absolute inset-0 h-full w-full bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
                    style={{ backgroundImage: `url('${asset(collection.image)}')` }}
                  />
                )}
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/40 to-transparent"
                />
                <div className="relative z-10 flex flex-col gap-1 p-stack-sm">
                  <Icon
                    name={collection.icon ?? 'photo_library'}
                    className="text-[18px] text-on-primary/80"
                  />
                  <h3 className="font-headline-md text-[17px] leading-tight text-on-primary">
                    {collection.title}
                  </h3>
                  <p className="font-label-caps text-[9px] uppercase tracking-widest text-inverse-primary">
                    {inCollection.length} {inCollection.length === 1 ? 'journey' : 'journeys'}
                  </p>
                </div>
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
    <div className="flex flex-col rounded-lg bg-surface-container-lowest p-stack-sm shadow-sm">
      <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
        {label}
      </span>
      <span className="mt-1 font-headline-md text-headline-md text-primary">{value}</span>
    </div>
  );
}
