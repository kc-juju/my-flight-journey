import { useMemo, useState } from 'react';
import { useAtlas } from '../hooks/useAtlas';
import { JourneyCard } from '../components/journey/JourneyCard';
import { Icon } from '../components/ui/Icon';
import { journeyYear } from '../lib/atlas';
import { MODE_ICON, MODE_LABEL } from '../lib/format';
import { TRANSPORT_MODES, type TransportMode } from '../types/journey';

export function JourneysPage() {
  const { journeys, metricsFor, metrics, data } = useAtlas();
  const [year, setYear] = useState<number | null>(null);
  const [mode, setMode] = useState<TransportMode | null>(null);
  const [collection, setCollection] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      journeys.filter((j) => {
        if (year !== null && journeyYear(j) !== year) return false;
        if (collection && !(j.collectionIds ?? [j.collectionId]).includes(collection))
          return false;
        if (mode && !j.segments.some((s) => s.mode === mode)) return false;
        return true;
      }),
    [journeys, year, mode, collection],
  );

  const usedModes = TRANSPORT_MODES.filter((m) => metrics.modeTotals[m] > 0);

  return (
    <div className="mx-auto flex w-full max-w-container flex-col gap-stack-lg px-margin-mobile py-stack-lg lg:px-margin-desktop">
      <header className="flex flex-col gap-unit">
        <h1 className="font-display-lg text-display-lg-mobile tracking-tight text-on-surface md:text-display-lg">
          Every journey, in order
        </h1>
        <p className="max-w-lg font-body-md text-on-surface-variant">
          Flights are only part of it. Filter by year, by collection, or by how you actually
          got there.
        </p>
      </header>

      <div className="flex flex-col gap-stack-sm">
        <FilterRow label="Year">
          <Chip active={year === null} onClick={() => setYear(null)}>All</Chip>
          {metrics.years.map((y) => (
            <Chip key={y} active={year === y} onClick={() => setYear(y)}>{y}</Chip>
          ))}
        </FilterRow>

        <FilterRow label="Collection">
          <Chip active={collection === null} onClick={() => setCollection(null)}>All</Chip>
          {data.collections.map((c) => (
            <Chip
              key={c.id}
              active={collection === c.id}
              onClick={() => setCollection(c.id)}
            >
              {c.title.replace(' Collection', '')}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Transport">
          <Chip active={mode === null} onClick={() => setMode(null)}>Any</Chip>
          {usedModes.map((m) => (
            <Chip key={m} active={mode === m} onClick={() => setMode(m)}>
              <Icon name={MODE_ICON[m]} className="mr-1 text-[14px] align-[-2px]" />
              {MODE_LABEL[m]}
            </Chip>
          ))}
        </FilterRow>
      </div>

      <p className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
        {filtered.length} of {journeys.length} journeys
      </p>

      {filtered.length === 0 ? (
        <p className="py-stack-lg text-center font-body-md italic text-on-surface-variant">
          Nothing matches that combination yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((journey) => (
            <JourneyCard
              key={journey.id}
              journey={journey}
              metrics={metricsFor(journey)}
              variant="full"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 shrink-0 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({
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
      className={`rounded-full border px-3 py-1.5 font-label-caps text-[11px] uppercase tracking-widest transition-colors ${
        active
          ? 'border-primary bg-primary text-on-primary'
          : 'border-outline-variant/60 text-on-surface-variant hover:border-on-surface-variant'
      }`}
    >
      {children}
    </button>
  );
}
