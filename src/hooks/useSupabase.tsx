import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

interface AuthValue {
  configured: boolean;
  /** Where the magic link will send you back to. Must be allow-listed. */
  redirectTo: string;
  session: Session | null;
  loading: boolean;
  /** Send a magic link. Returns an error message, or null on success. */
  signIn: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /**
   * Query strings and hashes make the redirect harder to allow-list, and
   * Supabase silently falls back to the project's Site URL — which defaults to
   * http://localhost:3000 — whenever the value is not on the list.
   */
  const redirectTo =
    typeof window === 'undefined'
      ? ''
      : `${window.location.origin}${window.location.pathname}`;

  const signIn = useCallback(
    async (email: string) => {
      if (!supabase) return 'Supabase is not configured for this site.';
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      return error ? error.message : null;
    },
    [redirectTo],
  );

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ configured: isSupabaseConfigured, redirectTo, session, loading, signIn, signOut }),
    [redirectTo, session, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <SupabaseProvider>');
  return ctx;
}
