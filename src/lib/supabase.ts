import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * The anon key is meant to be public — it ships in every Supabase browser app.
 * What protects the data is row-level security, defined in supabase/schema.sql.
 */
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
