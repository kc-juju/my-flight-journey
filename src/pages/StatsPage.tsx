import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAtlas } from '../hooks/useAtlas';
import { StatisticsCard } from '../components/stats/StatisticsCard';
import { ImageCredits } from '../components/stats/ImageCredits';
import { Icon } from '../components/ui/Icon';
import { formatNumber, MODE_ICON, MODE_LABEL } from '../lib/format';
import { asset } from '../lib/asset';

const MOON_KM = 384_400;

export function StatsPage() {
  const { metrics, data, journeys } = useAtlas();
  const moonProgress = Math.min(100, (metrics.distanceKm / MOON_KM) * 100);

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
            <div className="mt-stack-md w-full">
              <div className="mb-2 flex justify-between font-label-caps text-label-caps uppercase text-on-surface-variant">
                <span>Earth (0 km)</span>
                <span>Moon ({formatNumber(MOON_KM)} km)</span>
              </div>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-container">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${moonProgress}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
              <p className="mt-4 font-body-md text-sm text-on-surface-variant">
                {moonProgress < 1
                  ? `That is ${moonProgress.toFixed(2)}% of the way to the moon — great-circle distance, not actual track.`
                  : `Roughly ${moonProgress.toFixed(1)}% of the way to the moon.`}
              </p>
            </div>
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

      <section className="flex flex-col gap-stack-lg">
        <header className="flex flex-col gap-unit">
          <h2 className="font-display-lg text-display-lg-mobile tracking-tight text-on-surface md:text-display-lg">
            Curated experiences
          </h2>
          <p className="max-w-lg font-body-md text-on-surface-variant">
            A library of categorised memories, organised by region.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
          {data.collections.map((collection) => {
            const inCollection = journeys.filter((j) => j.collectionId === collection.id);
            return (
              <motion.article
                key={collection.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="group relative flex min-h-[400px] flex-col justify-end overflow-hidden rounded-xl bg-surface-container-lowest shadow-md transition-transform duration-500 hover:-translate-y-1"
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
                <div className="relative z-10 flex flex-col gap-stack-sm p-stack-lg">
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-lowest/20 backdrop-blur-md">
                    <Icon name={collection.icon ?? 'photo_library'} className="text-on-primary" />
                  </div>
                  <h3 className="font-display-lg text-display-lg-mobile text-on-primary">
                    {collection.title}
                  </h3>
                  <p className="font-label-caps text-label-caps uppercase tracking-widest text-inverse-primary">
                    {inCollection.length} curated{' '}
                    {inCollection.length === 1 ? 'journey' : 'journeys'}
                  </p>
                  {collection.blurb && (
                    <p className="max-w-sm font-body-md text-on-primary/80">{collection.blurb}</p>
                  )}
                  <ul className="mt-4 flex flex-col gap-unit font-body-md text-on-primary/90">
                    {inCollection.map((j) => (
                      <li key={j.id}>
                        <Link
                          to={`/journeys/${j.slug}`}
                          className="flex items-center gap-3 transition-colors hover:text-tertiary-fixed"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-tertiary-fixed" />
                          {j.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.article>
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
