import { supabase } from './supabase';

/** What an owner has written about a journey, over what the build generated. */
export interface JourneyOverride {
  title?: string;
  note?: string;
}

export type Overrides = Record<string, JourneyOverride>;

export async function listOverrides(): Promise<Overrides> {
  if (!supabase) return {};

  const withNote = await supabase.from('journey_titles').select('journey_slug, title, note');
  // Before migration 004 the column is absent. A title someone has already
  // set should still show, so ask again for what does exist.
  const { data, error } = withNote.error
    ? await supabase.from('journey_titles').select('journey_slug, title')
    : withNote;
  if (error || !data) return {};

  return Object.fromEntries(
    data.map((row) => [
      row.journey_slug,
      {
        title: row.title ?? undefined,
        note: 'note' in row ? ((row.note as string | null) ?? undefined) : undefined,
      },
    ]),
  );
}

/**
 * Write one field of an override.
 *
 * Emptying the last field left on a journey removes the row rather than
 * leaving a record that says nothing — the generated title comes back.
 */
export async function setOverride(
  slug: string,
  field: 'title' | 'note',
  value: string,
  current: JourneyOverride | undefined,
): Promise<string | null> {
  if (!supabase) return 'Supabase is not configured for this site.';
  const wanted = value.trim();
  const other = field === 'title' ? current?.note : current?.title;

  if (!wanted && !other?.trim()) {
    const { error } = await supabase.from('journey_titles').delete().eq('journey_slug', slug);
    return error ? error.message : null;
  }

  const { error } = await supabase.from('journey_titles').upsert(
    {
      journey_slug: slug,
      title: field === 'title' ? wanted || null : (current?.title ?? null),
      note: field === 'note' ? wanted || null : (current?.note ?? null),
    },
    { onConflict: 'journey_slug' },
  );
  return error ? error.message : null;
}
