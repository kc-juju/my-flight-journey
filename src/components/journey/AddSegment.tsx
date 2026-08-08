import { useEffect, useMemo, useRef, useState } from 'react';
import { useAtlas } from '../../hooks/useAtlas';
import { useOwner } from '../../hooks/useOwner';
import { newSegmentId, type AddedSegment } from '../../lib/segment-additions';
import { TRANSPORT_MODES, type TransportMode } from '../../types/journey';
import { MODE_LABEL } from '../../lib/format';
import {
  loadAirports, placeFrom, searchAirports,
  type AddedPlace, type ReferenceAirport,
} from '../../lib/place-additions';
import { Icon } from '../ui/Icon';

/**
 * Putting a leg into a journey that the flight log never had.
 *
 * A trip is assembled from an export, and an export only knows what was
 * booked through it: a positioning flight bought at the airport, a train, the
 * replacement an airline puts you on after cancelling. Rather than wait for a
 * rebuild, the leg is written to the database and sorted into the itinerary
 * by its own departure time.
 *
 * Where it goes can be somewhere the atlas has never been. Searching reaches
 * a vendored list of every airport with scheduled service, and choosing one
 * teaches the atlas that place — with the list named as the source, because
 * a coordinate with no provenance is a guess.
 */
export function AddSegment({ slug }: { slug: string }) {
  const { data, addSegment, addPlace } = useAtlas();
  const owner = useOwner();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const places = useMemo(
    () =>
      [...data.places].sort((a, b) =>
        (a.code ?? a.name).localeCompare(b.code ?? b.name),
      ),
    [data.places],
  );

  // Airports picked out of the reference list but not yet saved: they only
  // become places if the leg using them is actually added.
  const [discovered, setDiscovered] = useState<Record<string, AddedPlace>>({});

  const [form, setForm] = useState({
    mode: 'flight' as TransportMode,
    fromPlaceId: '',
    toPlaceId: '',
    departure: '',
    arrival: '',
    reference: '',
    operator: '',
    vehicle: '',
    cabin: '',
    note: '',
  });

  if (!owner) return null;

  const set = (field: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const submit = async () => {
    if (!form.fromPlaceId || !form.toPlaceId) {
      setError('Choose where the leg starts and ends.');
      return;
    }
    if (form.fromPlaceId === form.toPlaceId) {
      setError('A leg has to go somewhere.');
      return;
    }
    setBusy(true);
    setError(null);

    // Somewhere new has to exist before a leg can point at it.
    for (const id of [form.fromPlaceId, form.toPlaceId]) {
      const place = discovered[id];
      if (!place) continue;
      const failed = await addPlace(place);
      if (failed) {
        setBusy(false);
        setError(failed);
        return;
      }
    }

    const leg: AddedSegment = {
      segmentId: newSegmentId(form.fromPlaceId, form.toPlaceId, Date.now()),
      mode: form.mode,
      fromPlaceId: form.fromPlaceId,
      toPlaceId: form.toPlaceId,
      departure: form.departure || undefined,
      arrival: form.arrival || undefined,
      reference: form.reference || undefined,
      operator: form.operator || undefined,
      vehicle: form.vehicle || undefined,
      cabin: form.cabin || undefined,
      note: form.note || undefined,
    };
    const failure = await addSegment(slug, leg);
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    setOpen(false);
    setForm((current) => ({
      ...current,
      fromPlaceId: '',
      toPlaceId: '',
      departure: '',
      arrival: '',
      reference: '',
      vehicle: '',
      note: '',
    }));
  };

  return (
    <div className="mt-stack-md flex flex-col gap-stack-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-fit items-center gap-2 rounded-full border border-dashed border-outline-variant px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant transition-colors hover:border-on-surface-variant hover:text-on-surface"
      >
        <Icon name={open ? 'close' : 'add'} className="text-[16px]" />
        {open ? 'Cancel' : 'Add a leg'}
      </button>

      {open && (
        <form
          className="flex flex-col gap-stack-sm rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-stack-md"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="grid grid-cols-1 gap-stack-sm sm:grid-cols-2">
            <Field label="How">
              <select
                value={form.mode}
                onChange={(e) => set('mode')(e.target.value)}
                className={INPUT}
              >
                {TRANSPORT_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {MODE_LABEL[mode]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Number" hint="BR190, ICE 517">
              <input
                value={form.reference}
                onChange={(e) => set('reference')(e.target.value)}
                className={INPUT}
              />
            </Field>

            <Field label="From" hint="or search any airport">
              <PlacePicker
                places={places}
                value={form.fromPlaceId}
                onChange={set('fromPlaceId')}
                onDiscover={(p) => setDiscovered((c) => ({ ...c, [p.id]: p }))}
              />
            </Field>

            <Field label="To" hint="or search any airport">
              <PlacePicker
                places={places}
                value={form.toPlaceId}
                onChange={set('toPlaceId')}
                onDiscover={(p) => setDiscovered((c) => ({ ...c, [p.id]: p }))}
              />
            </Field>

            <Field label="Departure" hint="local time">
              <input
                type="datetime-local"
                value={form.departure}
                onChange={(e) => set('departure')(e.target.value)}
                className={INPUT}
              />
            </Field>

            <Field label="Arrival" hint="local time">
              <input
                type="datetime-local"
                value={form.arrival}
                onChange={(e) => set('arrival')(e.target.value)}
                className={INPUT}
              />
            </Field>

            <Field label="Operator" hint="EVA Air, JR West">
              <input
                value={form.operator}
                onChange={(e) => set('operator')(e.target.value)}
                className={INPUT}
              />
            </Field>

            <Field label="Aircraft or stock">
              <input
                value={form.vehicle}
                onChange={(e) => set('vehicle')(e.target.value)}
                className={INPUT}
              />
            </Field>
          </div>

          <Field label="Note" hint="where the times came from">
            <input
              value={form.note}
              onChange={(e) => set('note')(e.target.value)}
              className={INPUT}
            />
          </Field>

          <p className="font-body-md text-xs text-on-surface-variant">
            Searching reaches every airport with scheduled service. Choosing one the
            atlas has not been to adds it, with OurAirports named as the source.
          </p>

          {error && <p className="font-body-md text-xs text-error">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-fit rounded-full bg-primary px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest text-on-primary transition-opacity disabled:opacity-50"
          >
            {busy ? 'Adding…' : 'Add the leg'}
          </button>
        </form>
      )}
    </div>
  );
}

/**
 * Somewhere the atlas has been, or anywhere with an airport.
 *
 * Typing searches the places already on the map first — they are the likely
 * answer and cost nothing — and falls through to the reference list, which is
 * fetched the first time somebody types.
 */
function PlacePicker({
  places,
  value,
  onChange,
  onDiscover,
}: {
  places: { id: string; name: string; code?: string; country: string }[];
  value: string;
  onChange: (value: string) => void;
  onDiscover: (place: AddedPlace) => void;
}) {
  const [query, setQuery] = useState('');
  const [reference, setReference] = useState<ReferenceAirport[] | null>(null);
  const chosen = places.find((p) => p.id === value);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length >= 2 && !reference) void loadAirports().then(setReference);
  }, [query, reference]);

  const known = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    return places
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.code ?? '').toLowerCase() === q ||
          p.country.toLowerCase().startsWith(q),
      )
      .slice(0, 6);
  }, [places, query]);

  const found = useMemo(() => {
    if (!reference) return [];
    const have = new Set(places.map((p) => (p.code ?? '').toUpperCase()));
    return searchAirports(reference, query).filter((a) => !have.has(a.c));
  }, [reference, query, places]);

  if (chosen && !query) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex-1 truncate rounded-lg border border-outline-variant/70 bg-surface px-3 py-2 font-body-md text-sm text-on-surface">
          {chosen.code ? `${chosen.code} · ` : ''}
          {chosen.name}
        </span>
        <button
          type="button"
          onClick={() => onChange('')}
          className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant underline"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div ref={box} className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="City or airport code"
        className={INPUT}
      />

      {(known.length > 0 || found.length > 0) && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-lowest shadow-lg">
          {known.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(place.id);
                  setQuery('');
                }}
                className="flex w-full items-baseline gap-2 px-3 py-2 text-left font-body-md text-sm hover:bg-surface-container"
              >
                <span className="text-on-surface">
                  {place.code ? `${place.code} · ` : ''}
                  {place.name}
                </span>
                <span className="text-xs text-on-surface-variant">{place.country}</span>
              </button>
            </li>
          ))}

          {found.length > 0 && (
            <li className="border-t border-outline-variant/60 px-3 py-1 font-label-caps text-[9px] uppercase tracking-widest text-on-surface-variant">
              Not been yet
            </li>
          )}

          {found.map((airport) => (
            <li key={airport.c}>
              <button
                type="button"
                onClick={() => {
                  const place = placeFrom(airport);
                  onDiscover(place);
                  onChange(place.id);
                  setQuery('');
                }}
                className="flex w-full items-baseline gap-2 px-3 py-2 text-left font-body-md text-sm hover:bg-surface-container"
              >
                <span className="text-on-surface">
                  {airport.c} · {airport.m || airport.n}
                </span>
                <span className="truncate text-xs text-on-surface-variant">{airport.n}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const INPUT =
  'w-full rounded-lg border border-outline-variant/70 bg-surface px-3 py-2 font-body-md text-sm text-on-surface outline-none focus:border-on-surface-variant';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
          {label}
        </span>
        {hint && (
          <span className="font-body-md text-[11px] text-on-surface-variant/70">{hint}</span>
        )}
      </span>
      {children}
    </label>
  );
}
