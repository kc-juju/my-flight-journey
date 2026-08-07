import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useAtlas } from '../hooks/useAtlas';
import { WorldMap } from '../components/map/WorldMap';
import { JourneyPopup } from '../components/map/JourneyPopup';
import { Timeline } from '../components/journey/Timeline';
import { Icon } from '../components/ui/Icon';
import type { Journey } from '../types/journey';
import { formatDateRange, formatMonthYear, formatNumber } from '../lib/format';
import { journeyYear } from '../lib/atlas';
import { asset } from '../lib/asset';

export function MapPage() {
  const { journeys, placesById, metricsFor, metrics } = useAtlas();
  const navigate = useNavigate();

  const [hovered, setHovered] = useState<Journey | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<Journey | null>(null);
  const [year, setYear] = useState<number | null>(null);

  const visible = useMemo(
    () => (year === null ? journeys : journeys.filter((j) => journeyYear(j) === year)),
    [journeys, year],
  );

  const active = selected ?? hovered;

  // "Recent" means travelled. Booked-but-not-yet-flown journeys get their own
  // group so the list is not a mix of memory and intention.
  const flown = useMemo(() => visible.filter((j) => j.status === 'completed'), [visible]);
  // The flown list reads newest first, but a plan reads soonest first — the
  // next trip is the one you want to see, not the furthest one away.
  const upcoming = useMemo(
    () =>
      visible
        .filter((j) => j.status !== 'completed')
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [visible],
  );

  // Totals for whatever the map is showing, so picking a year says something
  // about that year rather than repeating the all-time figures.
  const overview = useMemo(() => {
    const cities = new Set<string>();
    const countries = new Set<string>();
    let km = 0;
    let flights = 0;
    for (const journey of visible) {
      const transfers = new Set(journey.transferPlaceIds ?? []);
      for (const segment of journey.segments) {
        if (segment.dropped) continue;
        if (segment.mode === 'flight') flights += 1;
        for (const id of [segment.fromPlaceId, segment.toPlaceId]) {
          const place = placesById.get(id);
          if (!place || place.home || transfers.has(id)) continue;
          // A country still counts when all you saw of it was a mountain
          // range; the city tally does not.
          countries.add(place.countryCode);
          if (place.kind !== 'landscape') cities.add(place.name);
        }
      }
      km += metricsFor(journey).distanceKm;
    }
    const next = visible
      .filter((j) => j.status !== 'completed')
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
    const days = next
      ? Math.ceil(
          (Date.parse(`${next.startDate}T00:00:00Z`) - Date.now()) / 86_400_000,
        )
      : null;
    return { cities: cities.size, countries: countries.size, km, flights, next, days };
  }, [visible, placesById, metricsFor]);

  const handleHover = (journey: Journey | null, event?: { clientX: number; clientY: number }) => {
    if (selected) return;
    setHovered(journey);
    setPointer(event ? { x: event.clientX, y: event.clientY } : null);
  };

  const openJourney = (journey: Journey) => {
    setHovered(null);
    setPointer(null);
    setSelected(journey);
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] w-full flex-col overflow-hidden">
      {/* What the map is showing, in numbers */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b border-outline-variant/40 bg-surface px-margin-mobile py-stack-sm lg:px-margin-desktop">
        <h1 className="font-display-lg text-headline-md text-on-surface">
          {year === null ? 'Everywhere so far' : `${year} in numbers`}
        </h1>

        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <span className="flex items-baseline gap-2">
            <span className="font-stat-display text-stat-display text-on-surface">
              {formatNumber(overview.km)}
            </span>
            <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
              km travelled
            </span>
          </span>

          <span aria-hidden className="hidden h-8 w-px bg-outline-variant/60 sm:block" />

          <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            {([
              ['Journeys', visible.length],
              ['Flights', overview.flights],
              ['Countries', overview.countries],
              ['Cities', overview.cities],
            ] as const).map(([label, value]) => (
              <div key={label} className="flex flex-col items-center">
                <dd className="font-stat-display text-[22px] leading-tight text-on-surface">
                  {value}
                </dd>
                <dt className="font-label-caps text-[9px] uppercase tracking-widest text-on-surface-variant">
                  {label}
                </dt>
              </div>
            ))}
          </dl>

          {overview.next && overview.days !== null && overview.days >= 0 && (
            <Link
              to={`/journeys/${overview.next.slug}`}
              className="flex items-center gap-2 rounded-full border border-outline-variant/60 px-3 py-1 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant transition-colors hover:border-on-surface-variant hover:text-on-surface"
            >
              <Icon name="flight_takeoff" className="text-[14px]" />
              Next · {overview.days === 0 ? 'today' : `${overview.days} days`}
            </Link>
          )}
        </div>
      </div>

      {/* The map, and everything that floats over it */}
      <div className="relative min-h-[560px] flex-1">
        <div className="absolute inset-0 z-0">
        <WorldMap
          journeys={visible}
          placesById={placesById}
          activeId={active?.id ?? null}
          focus={selected}
          onRecentre={() => setSelected(null)}
          onHover={handleHover}
          onSelect={openJourney}
        />
      </div>

      {/* Year filter */}
      <div className="pointer-events-none absolute inset-x-0 top-stack-md z-[600] flex justify-center px-margin-mobile">
        <div className="pointer-events-auto flex max-w-full flex-nowrap gap-1 overflow-x-auto rounded-full border border-outline-variant/40 bg-surface/85 p-1 shadow-lg backdrop-blur-xl lg:flex-wrap lg:justify-center">
          <FilterChip active={year === null} onClick={() => setYear(null)}>
            All&nbsp;years
          </FilterChip>
          {[...metrics.years].reverse().map((y) => (
            <FilterChip key={y} active={year === y} onClick={() => setYear(y)}>
              {y}
            </FilterChip>
          ))}
        </div>
      </div>

      <JourneyPopup
        journey={selected ? null : hovered}
        metrics={hovered ? metricsFor(hovered) : null}
        position={pointer}
      />

      {/* Recent journeys, along the bottom */}
      <AnimatePresence>
        {!selected && (
          <motion.aside
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-x-0 bottom-margin-mobile z-[600] flex flex-col gap-stack-sm px-margin-mobile lg:bottom-margin-desktop lg:px-margin-desktop lg:pr-20"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="pointer-events-auto flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface/85 px-4 py-1.5 font-display-lg text-[18px] text-on-surface shadow-lg backdrop-blur-xl">
                <Icon name="flight_land" className="text-[18px] text-on-surface-variant" />
                {year === null ? 'Recent journeys' : `${year} journeys`}
              </span>

              {upcoming.slice(0, 2).map((journey) => (
                <Link
                  key={journey.id}
                  to={`/journeys/${journey.slug}`}
                  onMouseEnter={() => setHovered(journey)}
                  onMouseLeave={() => setHovered(null)}
                  className="pointer-events-auto flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface/85 px-3 py-1.5 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant shadow-lg backdrop-blur-xl transition-colors hover:text-on-surface"
                >
                  <Icon name="flight_takeoff" className="text-[14px]" />
                  {journey.title} · {formatMonthYear(journey.startDate)}
                </Link>
              ))}
            </div>

            {flown.length > 0 ? (
              // Every flown journey, as a rail. Three big cards blocked the
              // map they were annotating; small ones you can scroll past do
              // not, and they let the whole list be here rather than a third
              // of it.
              <div className="atlas-rail pointer-events-auto flex snap-x gap-3 overflow-x-auto pb-2">
                {flown.map((journey) => {
                  const m = metricsFor(journey);
                  return (
                    <Link
                      key={journey.id}
                      to={`/journeys/${journey.slug}`}
                      onMouseEnter={() => !selected && setHovered(journey)}
                      onMouseLeave={() => setHovered(null)}
                      className={`group flex w-[196px] shrink-0 snap-start gap-3 rounded-xl border bg-surface/90 p-2 shadow-lg backdrop-blur-xl transition-colors ${
                        active?.id === journey.id
                          ? 'border-tertiary-fixed-dim'
                          : 'border-outline-variant/40 hover:border-on-surface-variant/40'
                      }`}
                    >
                      {journey.heroImage ? (
                        <img
                          src={asset(journey.heroImage)}
                          alt=""
                          loading="lazy"
                          className="h-14 w-14 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface-container">
                          <Icon name="public" className="text-[18px] text-on-surface-variant" />
                        </span>
                      )}

                      <span className="flex min-w-0 flex-col justify-center">
                        <span className="font-label-caps text-[9px] uppercase tracking-widest text-tertiary-fixed-dim">
                          {formatMonthYear(journey.startDate)}
                        </span>
                        <span className="line-clamp-2 font-headline-md text-[15px] leading-tight text-on-surface">
                          {journey.title}
                        </span>
                        <span className="truncate font-label-caps text-[9px] uppercase tracking-widest text-on-surface-variant">
                          {m.cityCount} {m.cityCount === 1 ? 'city' : 'cities'} ·{' '}
                          {formatNumber(m.distanceKm)} km
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="pointer-events-auto w-fit rounded-lg bg-surface/85 px-3 py-2 font-body-md text-sm italic text-on-surface-variant shadow-lg backdrop-blur-xl">
                Nothing flown {year === null ? 'yet' : `in ${year}`}.
              </p>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Journey detail panel */}
      <AnimatePresence>
        {selected && (
          <motion.aside
            key={selected.id}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
            className="absolute right-0 top-0 z-[700] flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-outline-variant/30 bg-surface/95 shadow-[-4px_0_24px_rgba(0,0,0,0.1)] backdrop-blur-2xl"
            aria-label={`${selected.title} details`}
          >
            <div className="flex-1 p-stack-md">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="font-display-lg text-headline-md text-on-surface">
                  {selected.title}
                </h2>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-surface-variant/50"
                  aria-label="Close journey details"
                >
                  <Icon name="close" className="text-on-surface-variant" />
                </button>
              </div>

              {selected.heroImage && (
                <div className="mb-6 h-48 w-full overflow-hidden rounded-xl shadow-md">
                  <img src={asset(selected.heroImage)} alt="" className="h-full w-full object-cover" />
                </div>
              )}

              <div className="mb-8 flex items-center gap-2 text-on-surface-variant">
                <Icon name="calendar_month" className="text-[18px]" />
                <span className="font-label-caps text-label-caps uppercase tracking-widest">
                  {formatDateRange(selected.startDate, selected.endDate)}
                </span>
              </div>

              <dl className="mb-8 grid grid-cols-3 gap-4">
                {(() => {
                  const m = metricsFor(selected);
                  return [
                    { label: 'Days', value: m.days },
                    { label: 'Flights', value: m.flightCount },
                    { label: 'Distance', value: `${formatNumber(m.distanceKm)} km` },
                  ].map((s) => (
                    <div key={s.label}>
                      <dt className="font-label-caps text-[10px] uppercase text-on-surface-variant">
                        {s.label}
                      </dt>
                      <dd className="font-headline-md text-[18px] text-on-surface">{s.value}</dd>
                    </div>
                  ));
                })()}
              </dl>

              <h3 className="mb-4 border-b border-outline-variant/30 pb-2 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
                Itinerary
              </h3>
              <Timeline stops={selected.stops} placesById={placesById} />
            </div>

            <div className="border-t border-outline-variant/30 bg-surface-container-low p-stack-md">
              <button
                type="button"
                onClick={() => navigate(`/journeys/${selected.slug}`)}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-label-caps text-label-caps uppercase text-on-primary transition-colors hover:bg-primary/90"
              >
                View full travelogue
                <Icon name="menu_book" className="text-[16px]" />
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1.5 font-label-caps text-[11px] uppercase tracking-widest transition-colors ${
        active
          ? 'bg-primary text-on-primary'
          : 'text-on-surface-variant hover:bg-surface-container'
      }`}
    >
      {children}
    </button>
  );
}
