import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useSupabase';
import { Icon } from '../ui/Icon';

interface Entry {
  id: string;
  name: string;
  message: string;
  created_at: string;
  journey_slug: string | null;
}

interface GuestbookProps {
  /** Scope the thread to one journey. Omitted, it is the site-wide book. */
  journeySlug?: string;
  /** `page` gets the big heading; `inline` sits inside a journey. */
  variant?: 'page' | 'inline';
}

const NAME_MAX = 40;
const MESSAGE_MAX = 800;

function relative(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(then).toISOString().slice(0, 10);
}

export function Guestbook({ journeySlug, variant = 'page' }: GuestbookProps = {}) {
  const { configured, session } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(configured);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    let query = supabase
      .from('guestbook')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    // A journey shows only its own thread; the guestbook page shows everything.
    if (journeySlug) query = query.eq('journey_slug', journeySlug);
    const { data } = await query;
    setEntries((data ?? []) as Entry[]);
    setLoading(false);
  }, [journeySlug]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!configured) {
    return (
      <section className="rounded-xl border border-dashed border-outline-variant p-stack-lg">
        <h2 className="mb-stack-sm font-headline-md text-headline-md text-on-surface">
          {journeySlug ? 'Comments' : 'Guestbook'}
        </h2>
        <p className="font-body-md text-on-surface-variant">
          This needs its backend configured before it can accept messages.
        </p>
      </section>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const trimmedName = name.trim();
    const trimmedMessage = message.trim();
    if (!trimmedName || !trimmedMessage) return;

    setSending(true);
    setStatus(null);
    const { error } = await supabase
      .from('guestbook')
      .insert({
        name: trimmedName,
        message: trimmedMessage,
        journey_slug: journeySlug ?? null,
      });
    setSending(false);

    if (error) {
      setStatus(error.message);
      return;
    }
    setMessage('');
    setStatus('Thanks for signing.');
    void load();
  };

  const remove = async (entry: Entry) => {
    if (!supabase) return;
    await supabase.from('guestbook').delete().eq('id', entry.id);
    void load();
  };

  return (
    <section className="flex flex-col gap-stack-lg">
      <header className="flex flex-col gap-unit">
        {variant === 'page' ? (
          <>
            <h1 className="font-display-lg text-display-lg-mobile tracking-tight text-on-surface md:text-display-lg">
              Guestbook
            </h1>
            <p className="max-w-lg font-body-md text-on-surface-variant">
              Been somewhere on this map? Recognise a flight? Leave a note.
            </p>
          </>
        ) : (
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Comments
          </h2>
        )}
      </header>

      <form
        onSubmit={submit}
        className="flex flex-col gap-stack-sm rounded-xl bg-surface-container-lowest p-stack-md shadow-sm"
      >
        <div className="flex flex-col gap-stack-sm sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
            required
            placeholder="Your name"
            aria-label="Your name"
            className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 font-body-md text-on-surface sm:max-w-[220px]"
          />
          <span className="self-center font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
            {message.length}/{MESSAGE_MAX}
          </span>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
          required
          rows={4}
          placeholder="Say hello…"
          aria-label="Your message"
          className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 font-body-md text-on-surface"
        />
        <button
          type="submit"
          disabled={sending}
          className="self-start rounded-full bg-primary px-6 py-2 font-label-caps text-label-caps uppercase text-on-primary disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Sign the guestbook'}
        </button>
        {status && (
          <p className="font-body-md text-sm text-on-surface-variant" role="status">
            {status}
          </p>
        )}
      </form>

      {loading ? (
        <p className="font-body-md text-sm italic text-on-surface-variant">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="font-body-md text-sm italic text-on-surface-variant">
          Nobody has signed yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-stack-sm">
          <AnimatePresence initial={false}>
            {entries.map((entry) => (
              <motion.li
                key={entry.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl bg-surface-container-lowest p-stack-md shadow-sm"
              >
                <div className="mb-1 flex items-baseline justify-between gap-4">
                  <span className="font-headline-md text-[18px] text-on-surface">
                    {entry.name}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
                      {relative(entry.created_at)}
                    </span>
                    {session && (
                      <button
                        type="button"
                        onClick={() => void remove(entry)}
                        aria-label={`Delete message from ${entry.name}`}
                        className="text-on-surface-variant hover:text-error"
                      >
                        <Icon name="delete" className="text-[16px]" />
                      </button>
                    )}
                  </span>
                </div>
                <p className="whitespace-pre-wrap font-body-md text-on-surface-variant">
                  {entry.message}
                </p>
                {!journeySlug && entry.journey_slug && (
                  <Link
                    to={`/journeys/${entry.journey_slug}`}
                    className="mt-1 inline-block font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant underline"
                  >
                    on {entry.journey_slug}
                  </Link>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
