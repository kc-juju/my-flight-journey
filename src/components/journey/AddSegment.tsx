import { useMemo, useState } from 'react';
import { useAtlas } from '../../hooks/useAtlas';
import { useOwner } from '../../hooks/useOwner';
import { newSegmentId, type AddedSegment } from '../../lib/segment-additions';
import { TRANSPORT_MODES, type TransportMode } from '../../types/journey';
import { MODE_LABEL } from '../../lib/format';
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
 * Where it goes is chosen from places the atlas already has. That is a real
 * limit — a first visit somewhere needs coordinates, and those belong in the
 * repository with a source, not typed into a form.
 */
export function AddSegment({ slug }: { slug: string }) {
  const { data, addSegment } = useAtlas();
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

            <Field label="From">
              <PlaceSelect
                places={places}
                value={form.fromPlaceId}
                onChange={set('fromPlaceId')}
              />
            </Field>

            <Field label="To">
              <PlaceSelect
                places={places}
                value={form.toPlaceId}
                onChange={set('toPlaceId')}
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
            Only places the atlas already knows can be chosen. Somewhere new needs
            coordinates, and those belong in the repository with a source.
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

function PlaceSelect({
  places,
  value,
  onChange,
}: {
  places: { id: string; name: string; code?: string; country: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={INPUT}>
      <option value="">—</option>
      {places.map((place) => (
        <option key={place.id} value={place.id}>
          {place.code ? `${place.code} · ` : ''}
          {place.name}, {place.country}
        </option>
      ))}
    </select>
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
