import { useState } from 'react';
import { useAtlas } from '../../hooks/useAtlas';
import { useOwner } from '../../hooks/useOwner';
import type { Segment } from '../../types/journey';
import type { SegmentChange as Change } from '../../lib/segment-changes';
import { Icon } from '../ui/Icon';

/**
 * Recording what an airline did to a leg that has not been flown yet.
 *
 * A booked flight is a plan, and plans move: a departure slides two hours, a
 * 787 becomes an A330, a leg is cancelled the week before. None of that can
 * wait for a rebuild, so it is written straight to the database and laid
 * over the flight log as the page loads.
 *
 * Only the owner sees the form. Everyone sees the result, and everyone sees
 * that it was changed — a time that quietly differs from the ticket in
 * somebody's inbox is worse than no time at all.
 */
export function SegmentChangeControls({
  slug,
  segment,
  flown,
}: {
  slug: string;
  segment: Segment;
  /** A leg already travelled is a record, not a plan; it is not edited here. */
  flown: boolean;
}) {
  const { editSegment, changeFor } = useAtlas();
  const owner = useOwner();
  const change = changeFor(slug, segment.id);
  const [open, setOpen] = useState(false);

  if (!change && (flown || !owner)) return null;

  return (
    <div className="mt-stack-sm flex flex-col gap-stack-sm">
      {change && <ChangeNotice change={change} />}

      {owner && !flown && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-fit items-center gap-1.5 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant underline decoration-outline-variant underline-offset-4 transition-colors hover:text-on-surface"
          >
            <Icon name="edit_calendar" className="text-[14px]" />
            {open ? 'Close' : change ? 'Amend the change' : 'Schedule change'}
          </button>

          {open && (
            <ChangeForm
              segment={segment}
              change={change}
              onSave={(next) => editSegment(slug, segment.id, next)}
              onDone={() => setOpen(false)}
            />
          )}
        </>
      )}
    </div>
  );
}

/** Shown to everybody: this leg is not what was originally booked. */
function ChangeNotice({ change }: { change: Change }) {
  const when = change.updatedAt?.slice(0, 10);
  const what = [
    change.dropped && 'cancelled',
    (change.departure || change.arrival) && 'retimed',
    change.reference && 'renumbered',
    change.vehicle && 'different aircraft',
  ].filter(Boolean) as string[];

  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-l-2 border-tertiary-fixed-dim pl-3 font-body-md text-xs text-on-surface-variant">
      <span className="font-label-caps text-[10px] uppercase tracking-widest text-tertiary-fixed-dim">
        Changed since booking
      </span>
      {what.length > 0 && <span>{what.join(' · ')}</span>}
      {change.note && <span className="italic">{change.note}</span>}
      {when && <span className="text-on-surface-variant/70">recorded {when}</span>}
    </p>
  );
}

function ChangeForm({
  segment,
  change,
  onSave,
  onDone,
}: {
  segment: Segment;
  change?: Change;
  onSave: (change: Change) => Promise<string | null>;
  onDone: () => void;
}) {
  const [form, setForm] = useState<Change>({
    departure: change?.departure ?? '',
    arrival: change?.arrival ?? '',
    reference: change?.reference ?? '',
    vehicle: change?.vehicle ?? '',
    dropped: change?.dropped ?? false,
    note: change?.note ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof Change) => (value: string | boolean) =>
    setForm((current) => ({ ...current, [field]: value }));

  const submit = async (next: Change) => {
    setBusy(true);
    setError(null);
    const failure = await onSave(next);
    setBusy(false);
    if (failure) setError(failure);
    else onDone();
  };

  return (
    <form
      className="flex flex-col gap-stack-sm rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-stack-sm"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(form);
      }}
    >
      <div className="grid grid-cols-1 gap-stack-sm sm:grid-cols-2">
        <Field
          label="New departure"
          hint={segment.departure ? `was ${segment.departure.replace('T', ' ')}` : 'none recorded'}
        >
          <input
            type="datetime-local"
            value={form.departure ?? ''}
            onChange={(e) => set('departure')(e.target.value)}
            className={INPUT}
          />
        </Field>

        <Field
          label="New arrival"
          hint={segment.arrival ? `was ${segment.arrival.replace('T', ' ')}` : 'none recorded'}
        >
          <input
            type="datetime-local"
            value={form.arrival ?? ''}
            onChange={(e) => set('arrival')(e.target.value)}
            className={INPUT}
          />
        </Field>

        <Field label="Flight number" hint={segment.reference ? `was ${segment.reference}` : '—'}>
          <input
            value={form.reference ?? ''}
            onChange={(e) => set('reference')(e.target.value)}
            placeholder={segment.reference ?? ''}
            className={INPUT}
          />
        </Field>

        <Field label="Aircraft" hint={segment.vehicle ? `was ${segment.vehicle}` : '—'}>
          <input
            value={form.vehicle ?? ''}
            onChange={(e) => set('vehicle')(e.target.value)}
            placeholder={segment.vehicle ?? ''}
            className={INPUT}
          />
        </Field>
      </div>

      <Field label="Why" hint="shown with the change">
        <input
          value={form.note ?? ''}
          onChange={(e) => set('note')(e.target.value)}
          placeholder="Schedule change from the airline"
          className={INPUT}
        />
      </Field>

      <label className="flex items-center gap-2 font-body-md text-sm text-on-surface">
        <input
          type="checkbox"
          checked={form.dropped ?? false}
          onChange={(e) => set('dropped')(e.target.checked)}
          className="h-4 w-4"
        />
        Cancelled — keep it visible, but out of every total
      </label>

      {error && <p className="font-body-md text-xs text-error">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-primary px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest text-on-primary transition-opacity disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save the change'}
        </button>

        {change && (
          <button
            type="button"
            disabled={busy}
            // Clearing every field deletes the row, which is how the flight
            // log gets the last word back.
            onClick={() => void submit({})}
            className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant underline decoration-outline-variant underline-offset-4 transition-colors hover:text-on-surface"
          >
            Undo — go back to what was booked
          </button>
        )}
      </div>
    </form>
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
