import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAtlas } from '../../hooks/useAtlas';
import type { Place } from '../../types/journey';
import { buildBreakdown, type Tally } from '../../lib/breakdown';
import {
  formatDayDate, formatDuration, formatNumber, plural,
} from '../../lib/format';
import { SPORTS, sportOf } from '../../lib/sports';
import { BallparkMap, type Park } from './BallparkMap';
import mlbParks from '../../data/mlb-parks.json';
import npbParks from '../../data/npb-parks.json';
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
    <section className="paper flex flex-col gap-stack-sm p-stack-md">
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
  // The page is an index first: every section states its size and opens on
  // demand, so the whole atlas is not scrolled past to reach the extremes.
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const isOpen = (key: string) => openSections.has(key);
  const toggleSection = (key: string) =>
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const [sport, setSport] = useState<string | null>(null);
  const [openCountry, setOpenCountry] = useState<string | null>(null);
  const [openAirport, setOpenAirport] = useState<string | null>(null);
  const [openFamily, setOpenFamily] = useState<string | null>(null);

  const maxYearKm = Math.max(...b.years.map((y) => y.distanceKm), 1);

  // The headline count upstairs leaves out countries only changed planes in,
  // this list keeps them. Rather than let the page contradict itself, work
  // out the difference and say it.
  const transitOnly = useMemo(() => {
    const stoodIn = new Set<string>();
    const all = new Set<string>();
    for (const journey of data.journeys) {
      if (journey.status === 'bucket') continue;
      const transfers = new Set(journey.transferPlaceIds ?? []);
      for (const segment of journey.segments) {
        if (segment.dropped) continue;
        for (const id of [segment.fromPlaceId, segment.toPlaceId]) {
          const place = placesById.get(id);
          if (!place) continue;
          all.add(place.countryCode);
          if (!place.home && !transfers.has(id)) stoodIn.add(place.countryCode);
        }
      }
    }
    return [...all].filter((code) => !stoodIn.has(code)).length;
  }, [data, placesById]);
  // This section is about airports; the ground-only towns have no code and
  // belong with their country, not in a list of airports.
  const airportsOnly = b.airportDetail.filter((row) => Boolean(row.place.code));

  // Games are written by hand rather than derived, so they are gathered here
  // rather than in buildBreakdown with everything the flight log implies.
  const ballgames = useMemo(() => {
    const games = data.journeys
      .filter((j) => j.status !== 'bucket')
      .flatMap((journey) =>
        (journey.events ?? [])
          .filter((e) => sportOf(e.kind))
          .map((event) => ({ event, journey })),
      )
      .sort((a, b2) => b2.event.date.localeCompare(a.event.date));

    const grounds = new Map<string, { place?: Place; games: typeof games }>();
    const teams = new Map<string, number>();
    const sports = new Map<string, number>();
    for (const game of games) {
      const key = game.event.placeId;
      const row = grounds.get(key) ?? { place: placesById.get(key), games: [] };
      row.games.push(game);
      grounds.set(key, row);
      // 'A vs B' is how a fixture is written; either side is a team seen.
      for (const side of game.event.title.split(/\s+vs\.?\s+/i)) {
        // Anything after a comma qualifies the fixture — 'game two', a round
        // of the playoffs — and is not part of the team's name.
        const name = side.split(',')[0].trim();
        if (name) teams.set(name, (teams.get(name) ?? 0) + 1);
      }
      const kind = game.event.kind;
      if (kind && sportOf(kind)) sports.set(kind, (sports.get(kind) ?? 0) + 1);
    }
    return {
      games,
      grounds: [...grounds.values()].sort((x, y) => y.games.length - x.games.length),
      teams: [...teams.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])),
      sports: [...sports.entries()]
        .map(([kind, count]) => [kind, SPORTS[kind]?.label ?? kind, count] as const)
        .sort((x, y) => y[2] - x[2]),
      repeats: [...teams.entries()].filter(([, n]) => n > 1).sort((x, y) => y[1] - x[1]),
      onceOnly: [...teams.values()].filter((n) => n === 1).length,
      groundPlaces: [...grounds.values()]
        .map((g) => g.place)
        .filter(Boolean) as Place[],
    };
  }, [data, placesById]);

  return (
    <div className="flex flex-col gap-margin-desktop">
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
          .map((card, i) => {
            const c = card as { label: string; value: string; sub: string };
            return (
              <div
                key={c.label}
                className={`paper ${['tilt-1','tilt-2','tilt-3','tilt-4'][i % 4]} flex flex-col justify-between p-stack-md`}
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
      {/* ---------------------------------------------------- countries -- */}
      <section className="flex flex-col gap-stack-md">
        <SectionRow
          title="Every country"
          summary={`Across ${plural(b.continents.length, 'continent')}${
            transitOnly
              ? `, ${transitOnly} of them only changed planes in — which is why the count upstairs is ${
                  b.countries.length - transitOnly
                }`
              : ''
          }. Open one for its cities and the airports or stations reached.`}
          count={`${b.countries.length} countries`}
          open={isOpen('countries')}
          onToggle={() => toggleSection('countries')}
        />

        {isOpen('countries') && (
          <>

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
                  <ul className="mt-stack-sm flex flex-wrap gap-2 border-t border-outline-variant/50 pt-stack-sm">
                    {/* Names only. Which airport served which city is a
                        different question, and 'Every airport' below answers
                        it — repeating the codes here said it twice. */}
                    {row.cities.map((city) => (
                      <li
                        key={city.name}
                        className="rounded-full border border-outline-variant/60 px-3 py-1 font-body-md text-sm text-on-surface"
                      >
                        {city.name}
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
          </>
        )}
      </section>

      {/* ---------------------------------------------------- ballgames -- */}
      {ballgames.games.length > 0 && (
        <section className="flex flex-col gap-stack-md">
          <SectionRow
            title="Every ground"
            summary={`${
              ballgames.sports.length > 0
                ? ballgames.sports.map(([, label, n]) => `${label.toLowerCase()} ×${n}`).join(', ')
                : 'Watched on the way to somewhere else'
            } · scores from the leagues' own records.`}
            count={`${plural(ballgames.games.length, 'game')} · ${plural(
              ballgames.grounds.length,
              'ground',
            )}`}
            open={isOpen('grounds')}
            onToggle={() => toggleSection('grounds')}
          />

          {isOpen('grounds') && (
            <>
              {ballgames.sports.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  <Chip active={sport === null} onClick={() => setSport(null)}>
                    All · {ballgames.games.length}
                  </Chip>
                  {ballgames.sports.map(([kind, label, count]) => (
                    <Chip key={kind} active={sport === kind} onClick={() => setSport(kind)}>
                      {label} · {count}
                    </Chip>
                  ))}
                </div>
              )}

              {/* The maps are baseball's; they say nothing about a cup tie. */}
              {(sport === null || sport === 'baseball') && (
                <div className="grid grid-cols-1 gap-gutter lg:grid-cols-2">
                  <BallparkMap
                    title="Major League grounds"
                    parks={mlbParks as Park[]}
                    visited={ballgames.groundPlaces}
                    center={[39.5, -96]}
                    zoom={3}
                  />
                  <BallparkMap
                    title="Nippon Professional Baseball grounds"
                    parks={npbParks as Park[]}
                    visited={ballgames.groundPlaces}
                    center={[37.5, 137]}
                    zoom={4}
                  />
                </div>
              )}

              {/* One line per game, newest first: the log a ticket stub keeps. */}
              <ol className="flex flex-col divide-y divide-outline-variant/40 rounded-xl bg-surface-container-lowest px-stack-md shadow-sm">
                {ballgames.games
                  .filter(({ event }) => !sport || event.kind === sport)
                  .map(({ event, journey }) => {
                    const at = placesById.get(event.placeId);
                    return (
                      <li key={event.date + event.title + (event.time ?? '')}>
                        <Link
                          to={`/journeys/${journey.slug}`}
                          className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-stack-sm transition-colors hover:text-tertiary-fixed-dim"
                        >
                          <Icon
                            name={sportOf(event.kind)?.icon ?? 'local_activity'}
                            className="text-[16px] text-tertiary-fixed-dim"
                          />
                          <span className="w-24 shrink-0 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
                            {formatDayDate(event.date)}
                          </span>
                          <span className="font-body-md text-sm text-on-surface">
                            {event.title}
                          </span>
                          <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
                            {at?.name}
                          </span>
                          <span className="ml-auto font-body-md text-xs text-on-surface-variant">
                            {event.detail}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
              </ol>

              {ballgames.repeats.length > 0 && (
                <p className="flex flex-wrap items-center gap-2 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
                  Seen more than once
                  {ballgames.repeats.map(([team, count]) => (
                    <span
                      key={team}
                      className="rounded-full border border-outline-variant/60 px-3 py-1 text-on-surface"
                    >
                      {team} ×{count}
                    </span>
                  ))}
                  <span>· {ballgames.onceOnly} others seen once</span>
                </p>
              )}
            </>
          )}
        </section>
      )}

      {/* ----------------------------------------------------- airports -- */}
      <section className="flex flex-col gap-stack-md">
        <SectionRow
          title="Every airport"
          summary="Open one to see everywhere it connects to and how often. Towns reached on the ground appear under their country, not here."
          count={plural(airportsOnly.length, 'airport')}
          open={isOpen('airports')}
          onToggle={() => toggleSection('airports')}
        />

        {isOpen('airports') && (
          <>

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
          </>
        )}
      </section>

      {/* ------------------------------------------------------- rankings -- */}
      <section className="flex flex-col gap-stack-md">
        <SectionRow
          title="Every aircraft and airline"
          summary="Which routes came up again, who flew them, in what cabin, and on what metal."
          count={`${plural(b.operators.length, 'operator')} · ${plural(
            b.aircraft.length,
            'model',
          )}`}
          open={isOpen('fleet')}
          onToggle={() => toggleSection('fleet')}
        />

        {isOpen('fleet') && (
          <div className="grid grid-cols-1 gap-gutter lg:grid-cols-2">
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

          </div>
        )}
      </section>

      {/* ---------------------------------------------------------- years -- */}
      <section className="flex flex-col gap-stack-md">
        <SectionRow
          title="Year by year"
          summary="Journeys, legs, distance and time on the move, and which countries were new that year."
          count={
            b.years.length
              ? `${b.years[0].year}–${b.years[b.years.length - 1].year}`
              : '—'
          }
          open={isOpen('years')}
          onToggle={() => toggleSection('years')}
        />

        {isOpen('years') && (
          <>
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
          </>
        )}
      </section>

    </div>
  );
}

/**
 * One openable row of the index.
 *
 * Every section used to announce itself in the same type as the page title,
 * so four closed sections read as four headings with nothing under them.
 * Sized like a list item instead, they read as what they are: doors.
 */
function SectionRow({
  title,
  summary,
  count,
  open,
  onToggle,
}: {
  title: string;
  summary: string;
  count: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`flex w-full items-baseline justify-between gap-4 border-b py-stack-sm text-left transition-colors ${
        open ? 'border-on-surface-variant/60' : 'border-outline-variant/50 hover:border-on-surface-variant/40'
      }`}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-headline-md text-[22px] leading-tight text-on-surface">
          {title}
        </span>
        <span className="font-body-md text-sm text-on-surface-variant">{summary}</span>
      </span>

      <span className="flex shrink-0 items-center gap-3">
        <span className="hidden font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant sm:inline">
          {count}
        </span>
        <Icon
          name={open ? 'expand_less' : 'expand_more'}
          className="text-[22px] text-on-surface-variant"
        />
      </span>
    </button>
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
