import { supabase } from './supabase';

/** Titles set by hand, keyed by journey slug. */
export type TitleOverrides = Record<string, string>;

export async function listTitles(): Promise<TitleOverrides> {
  if (!supabase) return {};
  const { data, error } = await supabase.from('journey_titles').select('journey_slug, title');
  if (error || !data) return {};
  return Object.fromEntries(data.map((row) => [row.journey_slug, row.title]));
}

/** Set a title. Passing an empty string restores the generated one. */
export async function setTitle(slug: string, title: string): Promise<string | null> {
  if (!supabase) return 'Supabase is not configured for this site.';
  const wanted = title.trim();

  if (!wanted) {
    const { error } = await supabase.from('journey_titles').delete().eq('journey_slug', slug);
    return error ? error.message : null;
  }

  const { error } = await supabase
    .from('journey_titles')
    .upsert({ journey_slug: slug, title: wanted }, { onConflict: 'journey_slug' });
  return error ? error.message : null;
}
