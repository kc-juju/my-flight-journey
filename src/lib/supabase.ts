import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * An unset GitHub Actions variable arrives as an empty string, not as
 * undefined — so `??` would happily accept "" and shadow the fallback.
 */
const firstSet = (...values: unknown[]): string | undefined =>
  values.find((v): v is string => typeof v === 'string' && v.trim() !== '');

const url = firstSet(import.meta.env.VITE_SUPABASE_URL);

/**
 * Supabase now issues `sb_publishable_...` keys alongside the older `anon`
 * JWTs, and both work. Accept either variable name so whichever one you copy
 * out of the dashboard lands correctly.
 *
 * Either key is meant to be public — it ships in every Supabase browser app.
 * What protects the data is row-level security, defined in supabase/schema.sql.
 */
const anonKey = firstSet(
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

export const PHOTO_BUCKET = 'journey-photos';

/** Public URL for a stored photo. */
export function photoUrl(path: string): string {
  if (!supabase) return '';
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}
