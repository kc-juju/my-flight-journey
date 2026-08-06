import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useSupabase';
import { amOwner } from '../../lib/photos';
import { Icon } from '../ui/Icon';

/**
 * The one place you sign in.
 *
 * Editing is scattered across the site — a title here, photographs there —
 * and a sign-in form beside each of them read like four different accounts.
 * The avatar in the header owns the session; everything else just asks
 * whether there is one.
 */
export function AccountMenu() {
  const { configured, session, signIn, signOut, redirectTo } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [owner, setOwner] = useState<boolean | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) {
      setOwner(null);
      return;
    }
    void amOwner().then(setOwner);
  }, [session]);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  if (!configured) return null;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={session ? `Signed in as ${session.user.email}` : 'Sign in'}
        title={session ? `Signed in as ${session.user.email}` : 'Sign in'}
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
          session ? 'bg-tertiary-fixed-dim text-primary' : 'bg-primary text-on-primary'
        }`}
      >
        <Icon name={session ? 'how_to_reg' : 'person'} className="text-[18px]" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-[290px] rounded-xl border border-outline-variant/50 bg-surface p-stack-md shadow-2xl">
          {session ? (
            <div className="flex flex-col gap-stack-sm">
              <div className="flex flex-col gap-0.5">
                <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
                  Signed in as
                </span>
                <span className="break-all font-body-md text-sm text-on-surface">
                  {session.user.email}
                </span>
              </div>

              <p className="font-body-md text-[13px] leading-snug text-on-surface-variant">
                {owner === false
                  ? 'This address is not on the owner list, so editing stays closed. Add it to site_owners in Supabase.'
                  : 'Photographs, titles and trip notes are open for editing while you are here.'}
              </p>

              <button
                type="button"
                onClick={() => {
                  void signOut();
                  setOpen(false);
                }}
                className="self-start rounded-full border border-outline-variant px-4 py-1.5 font-label-caps text-label-caps uppercase text-on-surface transition-colors hover:bg-surface-container"
              >
                Sign out
              </button>
            </div>
          ) : (
            <form
              className="flex flex-col gap-stack-sm"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                const error = await signIn(email);
                setBusy(false);
                setMessage(
                  error ??
                    `Check your inbox. The link returns to ${redirectTo}, which has to be ` +
                      'allow-listed in Supabase or it will go to localhost.',
                );
              }}
            >
              <p className="font-body-md text-[13px] leading-snug text-on-surface-variant">
                Sign in to add photographs, rename a journey, or leave a note on one.
                A link is emailed; there is no password.
              </p>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md text-sm text-on-surface"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-primary px-5 py-2 font-label-caps text-label-caps uppercase text-on-primary disabled:opacity-50"
              >
                {busy ? 'Sending…' : 'Email me a link'}
              </button>
            </form>
          )}

          {message && (
            <p className="mt-stack-sm font-body-md text-[13px] leading-snug text-on-surface-variant">
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
