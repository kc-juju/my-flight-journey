import { useEffect, useState } from 'react';
import type { Journey } from '../../types/journey';
import { useAtlas } from '../../hooks/useAtlas';
import { useOwner } from '../../hooks/useOwner';
import { Icon } from '../ui/Icon';

/**
 * The note about a trip, and — for an owner — a way to write it.
 *
 * The itinerary says where and when; this is the only part that can say why.
 * It sits inside the travel-notes card rather than beside it, so an edited
 * note reads exactly like one that came with the build.
 */
export function NoteEditor({ journey }: { journey: Journey }) {
  const { editJourney } = useAtlas();
  const owner = useOwner() === true;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(journey.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(journey.notes ?? '');
  }, [journey.notes]);

  const save = async () => {
    setBusy(true);
    setError(null);
    const failed = await editJourney(journey.slug, 'note', draft);
    setBusy(false);
    if (failed) {
      setError(failed);
      return;
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-stack-sm">
        <textarea
          value={draft}
          autoFocus
          rows={6}
          maxLength={2000}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="What was it actually like?"
          aria-label="Note about this trip"
          className="w-full resize-y rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md text-body-md leading-relaxed text-on-surface"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="rounded-full bg-primary px-5 py-2 font-label-caps text-label-caps uppercase text-on-primary disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(journey.notes ?? '');
              setEditing(false);
            }}
            className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant"
          >
            Cancel
          </button>
          <span className="ml-auto font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
            {draft.trim().length}/2000
          </span>
        </div>
        {error && (
          <p className="rounded-lg bg-error-container px-3 py-2 font-body-md text-sm text-on-error-container">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      {journey.notes ? (
        <p className="whitespace-pre-wrap font-body-lg leading-relaxed text-on-surface-variant first-letter:float-left first-letter:mr-3 first-letter:font-display-lg first-letter:text-5xl first-letter:text-primary">
          {journey.notes}
        </p>
      ) : (
        <p className="font-body-md italic text-on-surface-variant">
          Nothing written about this one yet.
        </p>
      )}

      {owner && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-stack-sm flex items-center gap-1 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant underline transition-colors hover:text-on-surface"
        >
          <Icon name="edit_note" className="text-[16px]" />
          {journey.notes ? 'Edit this note' : 'Write a note'}
        </button>
      )}
    </>
  );
}
