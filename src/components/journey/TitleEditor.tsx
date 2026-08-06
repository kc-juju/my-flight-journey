import { useEffect, useState } from 'react';
import type { Journey } from '../../types/journey';
import { useAtlas } from '../../hooks/useAtlas';
import { useAuth } from '../../hooks/useSupabase';
import { amOwner } from '../../lib/photos';
import { Icon } from '../ui/Icon';

/**
 * The journey's name, and — for an owner — a way to change it.
 *
 * The generated title describes the countries; only the traveller knows what
 * the trip was actually called. Clearing the box puts the generated one back
 * rather than leaving a journey with no name at all.
 */
export function TitleEditor({ journey }: { journey: Journey }) {
  const { renameJourney } = useAtlas();
  const { session } = useAuth();
  const [owner, setOwner] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(journey.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      setOwner(false);
      return;
    }
    void amOwner().then(setOwner);
  }, [session]);

  useEffect(() => {
    setDraft(journey.title);
  }, [journey.title]);

  const save = async (value: string) => {
    setBusy(true);
    setError(null);
    const failed = await renameJourney(journey.slug, value);
    setBusy(false);
    if (failed) {
      setError(failed);
      return;
    }
    setEditing(false);
  };

  if (!editing) {
    return (
      <h1 className="mb-2 flex flex-wrap items-baseline gap-3 font-display-lg text-display-lg-mobile text-on-primary drop-shadow-lg md:text-display-lg">
        {journey.title}
        {owner && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Rename this journey"
            title="Rename this journey"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface/20 text-on-primary backdrop-blur-md transition-colors hover:bg-surface/40"
          >
            <Icon name="edit" className="text-[16px]" />
          </button>
        )}
      </h1>
    );
  }

  return (
    <div className="mb-2 flex flex-col gap-2">
      <input
        value={draft}
        autoFocus
        maxLength={120}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save(draft);
          if (e.key === 'Escape') setEditing(false);
        }}
        aria-label="Journey title"
        className="w-full rounded-lg border border-surface-container-lowest/40 bg-surface/85 px-3 py-2 font-display-lg text-[28px] text-on-surface backdrop-blur-md md:text-[40px]"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save(draft)}
          className="rounded-full bg-primary px-5 py-2 font-label-caps text-label-caps uppercase text-on-primary disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(journey.title);
            setEditing(false);
          }}
          className="font-label-caps text-label-caps uppercase tracking-widest text-on-primary/80"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save('')}
          className="font-label-caps text-label-caps uppercase tracking-widest text-on-primary/60 underline disabled:opacity-50"
        >
          Use the generated title
        </button>
      </div>
      {error && (
        <p className="rounded-lg bg-error-container px-3 py-2 font-body-md text-sm text-on-error-container">
          {error}
        </p>
      )}
    </div>
  );
}
