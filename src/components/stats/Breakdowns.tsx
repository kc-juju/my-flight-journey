import { useMemo, useState } from 'react';
import { useAtlas } from '../../hooks/useAtlas';
import { buildBreakdown, type Tally } from '../../lib/breakdown';
import { formatDuration, formatNumber, MODE_ICON, MODE_LABEL, plural } from '../../lib/format';
import { Icon } from '../ui/Icon';

function RankTable({ title, rows, unit, limit = 10 }: {
  title: string;
  rows: Tally[];
  unit?: string;
  limit?: number;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, limit);
  const max = rows[0]?.count ?? 1;

  if (!rows.length) return null;

  return (
    <section className="flex flex-col gap-stack-sm rounded-xl bg-surface-container-lowest p-stack-md shadow-sm">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
          {title}
        </h3>
        <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
          {rows.length}
        </span>
      </div>
      <ol className="flex flex-col gap-1">
        {shown.map((row) => (
          <li key={row.key} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate font-body-md text-sm text-on-surface" title={row.label}>
              {row.label}
            </span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-container">
              <span
                className="block h-full rounded-full bg-tertiary-fixed-dim"
                style={{ width: `${(row.count / max) * 100}%` }}
              />
            </span>
            <span className="w-24 shrink-0 text-right font-label-caps text-[11px] uppercase tracking-widest text-on-surface-variant">
              {row.count}
              {unit ? ` ${unit}` : ''}
            </span>
          </li>
        ))}
      </ol>
      {rows.length > limit && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="self-start font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant underline"
        >
          {all ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </section>
  );
}

export function Breakdowns() {
  const { data, placesById } = useAtlas();
  const b = useMemo(() => buildBreakdown(data, placesById), [data, placesById]);
  const [openCountry, setOpenCountry] = useState<string | null>(null);
  const [openAirport, setOpenAirport] = useState<string | null>(null);
  const [openFamily, setOpenFamily] = useState<string | null>(null);

  const maxYearKm = Math.max(...b.years.map((y) => y.distanceKm), 1);
  // This section is about airports; the ground-only towns have no code and
  // belong with their country, not in a list of airports.
  const airportsOnly = b.airportDetail.filter((row) => Boolean(row.place.code));

  return (
    <div className="flex flex-col gap-margin-desktop">
      {/* ---------------------------------------------------- countries -- */}
      <section className="flex flex-col gap-stack-md">
        <header className="flex flex-col gap-unit">
          <h2 className="font-display-lg text-display-lg-mobile tracking-tight text-on-surface md:text-display-lg">
            Every country
          </h2>
          <p className="max-w-lg font-body-md text-on-surface-variant">
            {b.countries.length} countries and territories across{' '}
            {plural(b.continents.length, 'continent')}. Open one to see the cities, and
            the airports or stations reached in each.
          </p>
        </header>

        {b.continents.map((continent) => (
        <section key={continent.name} className="flex flex-col gap-stack-sm">
          <div className="flex items-baseline justify-between gap-3 border-b border-outline-variant/50 pb-1">
            <h3 className="font-headline-md text-[20px] text-on-surface">{continent.name}</h3>
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
              {plural(continent.countries.length, 'country', 'countries')} ·{' '}
              {plural(continent.cities, 'city', 'cities')}
            </span>
          </div>

        <ul className="grid grid-cols-1 gap-stack-sm md:grid-cols-2">
          {continent.countries.map((row) => {
            const open = openCountry === row.code;
            return (
              <li
                key={row.code}
                className="rounded-xl bg-surface-container-lowest p-stack-md shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenCountry(open ? null : row.code)}
                  aria-expanded={open}
                  className="flex w-full items-baseline justify-between gap-3 text-left"
                >
                  <span className="flex items-baseline gap-2">
                    <span className="font-headline-md text-[18px] text-on-surface">
                      {row.name}
                    </span>
                    <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
                      {row.code}
                      {row.code === b.homeCountry ? ' · home' : ''}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 font-label-caps text-[11px] uppercase tracking-widest text-on-surface-variant">
                    {row.cities.length
                      ? plural(row.cities.length, 'city', 'cities')
                      : 'Connection only'}
                    <Icon name={open ? 'expand_less' : 'expand_more'} className="text-[16px]" />
                  </span>
                </button>

                <p className="mt-1 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
                  {plural(row.journeys, 'journey')} · {plural(row.visits, 'call')} ·{' '}
                  {row.firstDate.slice(0, 4)}–{row.lastDate.slice(0, 4)}
                </p>

                {open && (
                  <ul className="mt-stack-sm flex flex-col gap-stack-sm border-t border-outline-variant/50 pt-stack-sm">
                    {row.cities.map((city) => (
                      <li key={city.name}>
                        <span className="font-body-md text-sm text-on-surface">{city.name}</span>
                        <ul className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-outline-variant/50 pl-3">
                          {city.places.map((place) => (
                            <li
                              key={place.id}
                              className="flex items-baseline justify-between gap-3 font-body-md text-xs text-on-surface-variant"
                            >
                              <span>{place.airportName ?? place.name}</span>
                              <span className="font-label-caps text-[10px] uppercase tracking-widest">
                                {place.code ?? 'ground'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        </section>
        ))}
      </section>

      {/* ----------------------------------------------------- airports -- */}
      <section className="flex flex-col gap-stack-md">
        <header className="flex flex-col gap-unit">
          <h2 className="font-display-lg text-display-lg-mobile tracking-tight text-on-surface md:text-display-lg">
            Every airport
          </h2>
          <p className="max-w-lg font-body-md text-on-surface-variant">
            {plural(airportsOnly.length, 'airport')}. Open one to see everywhere it
            connects to and how many times each route was flown. Towns reached on
            the ground appear under their country above, not here.
          </p>
        </header>

        <ul className="flex flex-col gap-stack-sm">
          {airportsOnly.map((row) => {
            const open = openAirport === row.place.id;
            const maxPartner = row.partners[0]?.count ?? 1;
            return (
              <li
                key={row.place.id}
                className="rounded-xl bg-surface-container-lowest p-stack-md shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenAirport(open ? null : row.place.id)}
                  aria-expanded={open}
                  className="flex w-full flex-wrap items-baseline justify-between gap-3 text-left"
                >
                  <span className="flex items-baseline gap-2">
                    <span className="font-headline-md text-[18px] text-on-surface">
                      {row.place.airportName ?? row.place.name}
                    </span>
                    <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
                      {row.place.code} · {row.place.country}
                    </span>
                  </span>
                  <span className="flex items-center gap-3 font-label-caps text-[11px] uppercase tracking-widest text-on-surface-variant">
                    <span>{plural(row.calls, 'call')}</span>
                    <span>{plural(row.partners.length, 'route')}</span>
                    <Icon name={open ? 'expand_less' : 'expand_more'} className="text-[16px]" />
                  </span>
                </button>

                <p className="mt-1 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
                  {row.departures} out · {row.arrivals} in · {plural(row.journeys, 'journey')} ·{' '}
                  {row.firstDate.slice(0, 4)}–{row.lastDate.slice(0, 4)}
                </p>

                {open && (
                  <ol className="mt-stack-sm flex flex-col gap-1 border-t border-outline-variant/50 pt-stack-sm">
                    {row.partners.map((partner) => (
                      <li key={partner.place.id} className="flex items-center gap-3">
                        <span className="w-52 shrink-0 truncate font-body-md text-sm text-on-surface">
                          {row.place.code} — {partner.place.code ?? partner.place.name}
                          <span className="ml-2 text-on-surface-variant">
                            {partner.place.name}
                          </span>
                        </span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-container">
                          <span
                            className="block h-full rounded-full bg-tertiary-fixed-dim"
                            style={{ width: `${(partner.count / maxPartner) * 100}%` }}
                          />
                        </span>
                        <span className="w-36 shrink-0 text-right font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
                          {partner.count}× · {partner.outbound}↗ {partner.inbound}↘ ·{' '}
                          {formatNumber(Math.round(partner.km))} km
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ------------------------------------------------------- rankings -- */}
      <section className="grid grid-cols-1 gap-gutter lg:grid-cols-2">
        <RankTable title="Routes, by times flown" rows={b.routes} />
        <RankTable title="Operators" rows={b.operators} />
        <RankTable title="Cabin" rows={b.cabins} limit={6} />

        <section className="flex flex-col gap-stack-sm rounded-xl bg-surface-container-lowest p-stack-md shadow-sm lg:col-span-2">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
              Aircraft, by family
            </h3>
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
              {b.aircraftFamilies.length} families · {b.aircraft.length} models
            </span>
          </div>
          <ol className="flex flex-col gap-1">
            {b.aircraftFamilies.map((row) => {
              const open = openFamily === row.family;
              const max = b.aircraftFamilies[0]?.count ?? 1;
              return (
                <li key={row.family}>
                  <button
                    type="button"
                    onClick={() => setOpenFamily(open ? null : row.family)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 py-1 text-left"
                  >
                    <span className="w-44 shrink-0 truncate font-body-md text-sm text-on-surface">
                      {row.family}
                    </span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-container">
                      <span
                        className="block h-full rounded-full bg-tertiary-fixed-dim"
                        style={{ width: `${(row.count / max) * 100}%` }}
                      />
                    </span>
                    <span className="w-28 shrink-0 text-right font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
                      {plural(row.count, 'leg')}
                      {row.models.length > 1 ? ` · ${row.models.length} models` : ''}
                    </span>
                    <Icon
                      name={open ? 'expand_less' : 'expand_more'}
                      className="text-[16px] text-on-surface-variant"
                    />
                  </button>

                  {open && (
                    <ul className="mb-stack-sm ml-4 flex flex-col gap-1 border-l border-outline-variant/50 pl-4">
                      {row.models.map((model) => (
                        <li
                          key={model.key}
                          className="flex items-baseline justify-between gap-3 font-body-md text-sm text-on-surface-variant"
                        >
                          <span>{model.label}</span>
                          <span className="font-label-caps text-[10px] uppercase tracking-widest">
                            {plural(model.count, 'leg')} ·{' '}
                            {formatNumber(Math.round(model.distanceKm ?? 0))} km
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        <section className="flex flex-col gap-stack-sm rounded-xl bg-surface-container-lowest p-stack-md shadow-sm">
          <h3 className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
            How it was travelled
          </h3>
          <ul className="flex flex-wrap gap-gutter">
            {Object.entries(b.modeTotals).map(([mode, n]) => (
              <li key={mode} className="flex items-center gap-2">
                <Icon
                  name={MODE_ICON[mode as keyof typeof MODE_ICON]}
                  className="text-[20px] text-on-surface-variant"
                />
                <span className="font-headline-md text-[18px] text-primary">{n}</span>
                <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
                  {MODE_LABEL[mode as keyof typeof MODE_LABEL]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </section>

      {/* ---------------------------------------------------------- years -- */}
      <section className="flex flex-col gap-stack-md">
        <header className="flex flex-col gap-unit">
          <h2 className="font-display-lg text-display-lg-mobile tracking-tight text-on-surface md:text-display-lg">
            Year by year
          </h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-outline-variant">
                {['Year', 'Journeys', 'Legs', 'Distance', 'Travelling', 'Countries', 'New'].map(
                  (h) => (
                    <th
                      key={h}
                      className="pb-2 pr-4 text-left font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {b.years.map((row) => (
                <tr key={row.year} className="border-b border-outline-variant/40">
                  <td className="py-2 pr-4 font-headline-md text-[16px] text-on-surface">
                    {row.year}
                  </td>
                  <td className="py-2 pr-4 text-on-surface-variant">{row.journeys}</td>
                  <td className="py-2 pr-4 text-on-surface-variant">{row.legs}</td>
                  <td className="py-2 pr-4 text-on-surface-variant">
                    <span className="flex items-center gap-2">
                      <span className="w-20">{formatNumber(Math.round(row.distanceKm))} km</span>
                      <span className="hidden h-1 w-24 overflow-hidden rounded-full bg-surface-container sm:block">
                        <span
                          className="block h-full rounded-full bg-tertiary-fixed-dim"
                          style={{ width: `${(row.distanceKm / maxYearKm) * 100}%` }}
                        />
                      </span>
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-on-surface-variant">
                    {formatDuration(Math.round(row.minutes))}
                  </td>
                  <td className="py-2 pr-4 text-on-surface-variant">{row.countries}</td>
                  <td className="py-2 text-on-surface-variant">
                    {row.newCountries.length ? row.newCountries.join(' ') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* --------------------------------------------------------- extremes */}
      <section className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-4">
        {[
          b.longest && {
            label: 'Longest leg',
            value: `${formatNumber(Math.round(b.longest.km))} km`,
            sub: `${b.longest.segment.reference ?? b.longest.segment.operator ?? ''} · ${b.longest.journey.title}`,
          },
          b.shortest && {
            label: 'Shortest leg',
            value: `${formatNumber(Math.round(b.shortest.km))} km`,
            sub: `${b.shortest.segment.reference ?? b.shortest.segment.operator ?? ''} · ${b.shortest.journey.title}`,
          },
          b.busiestYear && {
            label: 'Furthest year',
            value: String(b.busiestYear.year),
            sub: `${formatNumber(Math.round(b.busiestYear.distanceKm))} km over ${b.busiestYear.journeys} journeys`,
          },
          {
            label: 'Typical journey',
            value: `${b.averageJourneyDays.toFixed(1)} days`,
            sub: `average leg ${formatNumber(Math.round(b.averageLegKm))} km`,
          },
        ]
          .filter(Boolean)
          .map((card) => {
            const c = card as { label: string; value: string; sub: string };
            return (
              <div
                key={c.label}
                className="flex flex-col justify-between rounded-xl bg-surface-container p-stack-md"
              >
                <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
                  {c.label}
                </span>
                <span className="mt-stack-sm font-display-lg text-[28px] leading-none text-primary">
                  {c.value}
                </span>
                <span className="mt-1 font-body-md text-xs text-on-surface-variant">{c.sub}</span>
              </div>
            );
          })}
      </section>
    </div>
  );
}
