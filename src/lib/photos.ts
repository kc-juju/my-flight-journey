import exifr from 'exifr';
import { PHOTO_BUCKET, photoUrl, supabase } from './supabase';

export interface JourneyPhoto {
  id: string;
  journey_slug: string;
  storage_path: string;
  /** Naive local clock from EXIF, "2025-10-06T14:03". */
  taken_local: string | null;
  /** EXIF UTC offset in minutes, when the camera recorded one. */
  taken_offset_minutes: number | null;
  /** Instant we settled on, ISO with zone. */
  taken_instant: string | null;
  /** How the instant was determined. */
  time_basis: string | null;
  place_id: string | null;
  caption: string | null;
  created_at: string;
  url: string;
}

export interface ExifTime {
  naiveLocal?: string;
  offsetMinutes?: number | null;
  lat?: number;
  lon?: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Read the capture time without letting the browser's own zone leak in.
 *
 * exifr hands back a Date built from a naive string, so its UTC fields carry
 * the original digits. Reading them back with getUTC* recovers exactly what
 * the camera wrote.
 */
export async function readExifTime(file: File): Promise<ExifTime> {
  try {
    const out = await exifr.parse(file, {
      pick: ['DateTimeOriginal', 'CreateDate', 'OffsetTimeOriginal', 'OffsetTime',
             'latitude', 'longitude'],
      translateValues: false,
      reviveValues: true,
    });
    if (!out) return {};

    const when: Date | undefined = out.DateTimeOriginal ?? out.CreateDate;
    let naiveLocal: string | undefined;
    if (when instanceof Date && !Number.isNaN(when.getTime())) {
      naiveLocal =
        `${when.getUTCFullYear()}-${pad(when.getUTCMonth() + 1)}-${pad(when.getUTCDate())}` +
        `T${pad(when.getUTCHours())}:${pad(when.getUTCMinutes())}`;
    }

    const rawOffset: string | undefined = out.OffsetTimeOriginal ?? out.OffsetTime;
    let offsetMinutes: number | null = null;
    const m = rawOffset?.match(/([+-])(\d{2}):?(\d{2})/);
    if (m) {
      offsetMinutes = (Number(m[2]) * 60 + Number(m[3])) * (m[1] === '-' ? -1 : 1);
    }

    return { naiveLocal, offsetMinutes, lat: out.latitude, lon: out.longitude };
  } catch {
    return {};
  }
}

const HEIC_EXTENSION = /\.(heic|heif)$/i;

/**
 * iPhones hand over HEIC, which no browser will draw and which several
 * browsers report with an empty MIME type — so sniff the name as well.
 */
export function isHeic(file: File): boolean {
  return /^image\/hei[cf]/i.test(file.type) || HEIC_EXTENSION.test(file.name);
}

/** Anything a browser will draw, plus the HEIC we are about to convert. */
export function looksLikeImage(file: File): boolean {
  return (
    file.type.startsWith('image/') ||
    isHeic(file) ||
    /\.(jpe?g|png|gif|webp|avif|bmp)$/i.test(file.name)
  );
}

/**
 * Give back a file the browser can display.
 *
 * The decoder is a 3 MB wasm bundle, so it is only fetched when a HEIC
 * actually turns up. EXIF is read from the original — conversion drops it.
 */
export async function toDisplayable(file: File): Promise<File> {
  if (!isHeic(file)) return file;
  const { heicTo } = await import('heic-to');
  const blob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 });
  return new File([blob], file.name.replace(HEIC_EXTENSION, '.jpg'), {
    type: 'image/jpeg',
    lastModified: file.lastModified,
  });
}

/** Does the signed-in account appear on the owner list? */
export async function amOwner(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('is_owner');
  return !error && data === true;
}

export async function listPhotos(journeySlug: string): Promise<JourneyPhoto[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('journey_photos')
    .select('*')
    .eq('journey_slug', journeySlug)
    .order('taken_instant', { ascending: true, nullsFirst: false });
  if (error || !data) return [];
  return data.map((row) => ({ ...row, url: photoUrl(row.storage_path) }) as JourneyPhoto);
}

export async function uploadPhoto(args: {
  file: File;
  journeySlug: string;
  takenLocal?: string;
  offsetMinutes?: number | null;
  instant?: string;
  basis?: string;
  placeId?: string;
  caption?: string;
}): Promise<{ photo?: JourneyPhoto; error?: string }> {
  if (!supabase) return { error: 'Supabase is not configured for this site.' };

  const ext = args.file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${args.journeySlug}/${crypto.randomUUID()}.${ext}`;

  const up = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, args.file, { cacheControl: '31536000', upsert: false });
  if (up.error) {
    // Name the stage: a storage refusal and a database refusal need
    // different fixes, and both otherwise read as 'it did not work'.
    return { error: `Storage rejected the file: ${up.error.message}` };
  }

  const { data, error } = await supabase
    .from('journey_photos')
    .insert({
      journey_slug: args.journeySlug,
      storage_path: path,
      taken_local: args.takenLocal ?? null,
      taken_offset_minutes: args.offsetMinutes ?? null,
      taken_instant: args.instant ?? null,
      time_basis: args.basis ?? null,
      place_id: args.placeId ?? null,
      caption: args.caption ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    // Do not leave an orphan file behind if the row could not be written.
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    return {
      error: `The file uploaded but the record was refused: ${
        error?.message ?? 'unknown error'
      }`,
    };
  }
  return { photo: { ...data, url: photoUrl(data.storage_path) } as JourneyPhoto };
}

/** Edit the note on a photo that is already up. */
export async function updateCaption(id: string, caption: string): Promise<string | null> {
  if (!supabase) return 'Supabase is not configured for this site.';
  const { error } = await supabase
    .from('journey_photos')
    .update({ caption: caption.trim() || null })
    .eq('id', id);
  return error ? error.message : null;
}

export async function deletePhoto(photo: JourneyPhoto): Promise<string | null> {
  if (!supabase) return 'Supabase is not configured for this site.';
  const { error } = await supabase.from('journey_photos').delete().eq('id', photo.id);
  if (error) return error.message;
  // Storage cleanup is best-effort; the row is what the interface reads.
  await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
  return null;
}
