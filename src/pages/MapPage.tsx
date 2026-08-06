import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useAtlas } from '../hooks/useAtlas';
import { WorldMap } from '../components/map/WorldMap';
import { JourneyPopup } from '../components/map/JourneyPopup';
import { JourneyCard } from '../components/journey/JourneyCard';
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
  const upcoming = useMemo(() => visible.filter((j) => j.status !== 'completed'), [visible]);

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
    <div className="relative flex min-h-[calc(100vh-80px)] w-full flex-col overflow-hidden">
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
      <div className="pointer-events-none absolute left-margin-mobile right-margin-mobile top-stack-md z-[600] flex flex-wrap gap-2 lg:left-margin-desktop lg:right-auto">
        <div className="pointer-events-auto flex flex-wrap gap-1 rounded-full border border-outline-variant/40 bg-surface/85 p-1 shadow-lg backdrop-blur-xl">
          <FilterChip active={year === null} onClick={() => setYear(null)}>
            All years
          </FilterChip>
          {metrics.years.map((y) => (
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

      {/* Recent journeys */}
      <AnimatePresence>
        {!selected && (
          <motion.aside
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="pointer-events-none absolute bottom-margin-mobile left-margin-mobile z-[600] w-[calc(100%-40px)] max-w-md lg:bottom-margin-desktop lg:left-margin-desktop"
          >
            <div className="pointer-events-auto max-h-[52vh] overflow-y-auto rounded-xl border border-outline-variant/40 bg-surface/85 p-stack-md shadow-2xl backdrop-blur-xl">
              <h2 className="mb-stack-md flex items-center gap-2 border-b border-outline-variant/50 pb-stack-sm font-display-lg text-headline-md text-on-surface">
                <Icon name="flight_land" className="text-on-surface-variant" />
                {year === null ? 'Recent journeys' : `${year} journeys`}
              </h2>

              {flown.length === 0 && upcoming.length === 0 ? (
                <p className="py-4 text-sm italic text-on-surface-variant">
                  No journeys recorded in {year}.
                </p>
              ) : (
                <>
                  {flown.length > 0 ? (
                    <div className="flex flex-col gap-6">
                      {flown.slice(0, 4).map((journey) => (
                        <JourneyCard
                          key={journey.id}
                          journey={journey}
                          metrics={metricsFor(journey)}
                          onHoverStart={(j) => !selected && setHovered(j)}
                          onHoverEnd={() => setHovered(null)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="py-2 text-sm italic text-on-surface-variant">
                      Nothing flown {year === null ? 'yet' : `in ${year}`}.
                    </p>
                  )}

                  {upcoming.length > 0 && (
                    <div className="mt-stack-md border-t border-outline-variant/50 pt-stack-sm">
                      <h3 className="mb-stack-sm flex items-center gap-2 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
                        <Icon name="flight_takeoff" className="text-[16px]" />
                        Booked ahead · {upcoming.length}
                      </h3>
                      <ul className="flex flex-col gap-2">
                        {upcoming.map((journey) => (
                          <li key={journey.id}>
                            <Link
                              to={`/journeys/${journey.slug}`}
                              onMouseEnter={() => !selected && setHovered(journey)}
                              onMouseLeave={() => setHovered(null)}
                              className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-container"
                            >
                              <span className="font-body-md text-sm text-on-surface">
                                {journey.title}
                              </span>
                              <span className="shrink-0 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
                                {formatMonthYear(journey.startDate)}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
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
