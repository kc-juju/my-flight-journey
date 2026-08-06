import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Journey, Place } from '../../types/journey';
import { useAuth } from '../../hooks/useSupabase';
import {
  deletePhoto,
  listPhotos,
  looksLikeImage,
  readExifTime,
  toDisplayable,
  updateCaption,
  uploadPhoto,
  type JourneyPhoto,
} from '../../lib/photos';
import {
  basisLabel,
  placePhoto,
  slotForPlace,
  type PhotoPlacement,
} from '../../lib/photoPlacement';
import { placesOfJourney } from '../../lib/atlas';
import { useOwner } from '../../hooks/useOwner';
import { formatDayDate } from '../../lib/format';
import { Icon } from '../ui/Icon';

/** Photos grouped by the itinerary position they belong to. */
export type PhotosBySlot = Map<number, JourneyPhoto[]>;

export function usePhotoSlots(journey: Journey, placesById: Map<string, Place>) {
  const { configured } = useAuth();
  const [photos, setPhotos] = useState<JourneyPhoto[]>([]);
  const [loading, setLoading] = useState(configured);

  const refresh = useCallback(async () => {
    if (!configured) return;
    setLoading(true);
    setPhotos(await listPhotos(journey.slug));
    setLoading(false);
  }, [configured, journey.slug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const slots = useMemo<PhotosBySlot>(() => {
    const map: PhotosBySlot = new Map();
    for (const photo of photos) {
      // A city chosen by hand beats anything inferred from the clock.
      const placement =
        photo.time_basis === 'manual' && photo.place_id
          ? slotForPlace(journey, photo.place_id)
          : placePhoto(journey, placesById, {
              naiveLocal: photo.taken_local ?? undefined,
              offsetMinutes: photo.taken_offset_minutes,
            });
      const key = placement.afterSegmentIndex;
      map.set(key, [...(map.get(key) ?? []), photo]);
    }
    return map;
  }, [photos, journey, placesById]);

  return { photos, slots, loading, refresh, configured };
}

/** The strip of photos that sits between two itinerary segments. */
export function PhotoStrip({
  photos,
  onDeleted,
}: {
  photos: JourneyPhoto[];
  onDeleted: () => void;
}) {
  const { session } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  if (!photos.length) return null;

  const saveCaption = async (photo: JourneyPhoto) => {
    setBusy(photo.id);
    const error = await updateCaption(photo.id, draft);
    setBusy(null);
    setEditing(null);
    if (error) window.alert(`Could not save the note: ${error}`);
    else onDeleted();
  };

  const remove = async (photo: JourneyPhoto) => {
    setBusy(photo.id);
    const error = await deletePhoto(photo);
    setBusy(null);
    if (error) window.alert(`Could not delete: ${error}`);
    else onDeleted();
  };

  return (
    <ul className="flex flex-wrap gap-stack-sm px-2">
      <AnimatePresence initial={false}>
        {photos.map((photo) => (
          <motion.li
            key={photo.id}
            layout
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="group flex w-48 flex-col gap-1 sm:w-64"
          >
            <div className="relative h-48 w-48 overflow-hidden rounded-xl bg-surface-container shadow-md sm:h-64 sm:w-64">
            <img
              src={photo.url}
              alt={photo.caption ?? 'Journey photo'}
              loading="lazy"
              className="h-full w-full object-cover"
            />
            {photo.taken_local && (
              <span
                className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-primary/85 to-transparent px-2 pb-1 pt-5 font-label-caps text-[11px] uppercase tracking-widest text-on-primary"
                title={
                  photo.time_basis === 'exif-offset'
                    ? 'The clock the camera recorded, in its own time zone'
                    : 'Read in the local zone of where this journey says you were'
                }
              >
                {formatDayDate(photo.taken_local)} · {photo.taken_local.slice(11)}
                <span className="text-on-primary/70">&nbsp;local</span>
              </span>
            )}
            {session && (
              <button
                type="button"
                onClick={() => remove(photo)}
                disabled={busy === photo.id}
                aria-label="Delete photo"
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary/60 text-on-primary opacity-0 backdrop-blur-md transition-opacity hover:bg-error focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40"
              >
                <Icon name={busy === photo.id ? 'hourglass_empty' : 'close'} className="text-[16px]" />
              </button>
            )}
            </div>

            {editing === photo.id ? (
              <div className="flex flex-col gap-1">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  autoFocus
                  aria-label="Note for this photo"
                  className="w-full resize-y rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1 font-body-md text-[12px] text-on-surface"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void saveCaption(photo)}
                    disabled={busy === photo.id}
                    className="font-label-caps text-[10px] uppercase tracking-widest text-primary disabled:opacity-40"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              (photo.caption || session) && (
                <p className="font-body-md text-[12px] leading-snug text-on-surface-variant">
                  {photo.caption}
                  {session && (
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(photo.caption ?? '');
                        setEditing(photo.id);
                      }}
                      className="ml-1 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant underline"
                    >
                      {photo.caption ? 'Edit' : 'Add a note'}
                    </button>
                  )}
                </p>
              )
            )}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

interface PendingPhoto {
  file: File;
  /** What the picker was handed, before any HEIC conversion. */
  originalName: string;
  converted: boolean;
  caption: string;
  preview: string;
  /** What the timestamp says. Kept so 'Auto' can be restored. */
  auto: PhotoPlacement;
  /** Place id chosen by hand, or '' to trust the timestamp. */
  chosen: string;
  naiveLocal?: string;
  offsetMinutes?: number | null;
}

/** Drop photos here; each is read for its capture time and placed. */
export function PhotoUploader({
  journey,
  placesById,
  onUploaded,
}: {
  journey: Journey;
  placesById: Map<string, Place>;
  onUploaded: () => void;
}) {
  const { session, loading } = useAuth();
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const owner = useOwner();
  const [reading, setReading] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const accept = async (files: FileList | null) => {
    if (!files?.length) return;
    setMessage(null);
    setReading(files.length);
    const next: PendingPhoto[] = [];
    const skipped: string[] = [];
    for (const file of Array.from(files)) {
      if (!looksLikeImage(file)) {
        skipped.push(`${file.name} — not an image`);
        continue;
      }
      // EXIF comes from the file as picked; converting a HEIC drops it.
      const exif = await readExifTime(file);
      let display = file;
      try {
        display = await toDisplayable(file);
      } catch (err) {
        skipped.push(
          `${file.name} — could not be decoded (${
            err instanceof Error ? err.message : 'unknown error'
          })`,
        );
        continue;
      }
      next.push({
        file: display,
        originalName: file.name,
        converted: display !== file,
        caption: '',
        preview: URL.createObjectURL(display),
        naiveLocal: exif.naiveLocal,
        offsetMinutes: exif.offsetMinutes,
        chosen: '',
        auto: placePhoto(journey, placesById, {
          naiveLocal: exif.naiveLocal,
          offsetMinutes: exif.offsetMinutes,
        }),
      });
      setReading((n) => n - 1);
    }
    setReading(0);
    if (skipped.length) setMessage(`Skipped:\n${skipped.join('\n')}`);
    setPending((p) => [...p, ...next]);
  };

  // Cities this journey actually reached, in itinerary order, home aside.
  const all = placesOfJourney(journey, placesById);
  const away = all.filter((p) => !p.home);
  const choices = away.length ? away : all;

  const resolve = (item: PendingPhoto): PhotoPlacement => {
    if (!item.chosen) return item.auto;
    const place = placesById.get(item.chosen);
    return { ...slotForPlace(journey, item.chosen), place };
  };

  // Choosing a city is an explicit answer, so it rescues both a photo from
  // another trip and one whose file carries no clock at all — either way the
  // itinerary cannot file it on its own.
  const unfiled = (p: PendingPhoto) =>
    resolve(p).basis === 'outside-journey' || resolve(p).basis === 'unplaced';
  const accepted = pending.filter((p) => !unfiled(p));
  const rejected = pending.filter(unfiled);

  const commit = async () => {
    setBusy(true);
    setMessage(null);
    for (const item of accepted) {
      const placement = resolve(item);
      const { error } = await uploadPhoto({
        file: item.file,
        journeySlug: journey.slug,
        takenLocal: item.naiveLocal,
        offsetMinutes: item.offsetMinutes,
        instant: placement.instant,
        basis: placement.basis,
        placeId: item.chosen || placement.place?.id,
        caption: item.caption.trim() || undefined,
      });
      if (error) {
        setMessage(error);
        setBusy(false);
        return;
      }
    }
    accepted.forEach((p) => URL.revokeObjectURL(p.preview));
    setPending(rejected);
    setBusy(false);
    onUploaded();
  };

  if (loading) return null;

  // Signing in happens once, in the header. Down here we only ask whether it
  // has happened: no session, no uploader, no second login form to explain.
  if (!session) return null;

  return (
    <div className="flex flex-col gap-stack-sm rounded-xl border border-dashed border-outline-variant p-stack-md">
      {owner === false && (
        <p className="rounded-lg bg-error-container px-3 py-2 font-body-md text-sm text-on-error-container">
          This address is not in <code>site_owners</code>, so uploads will be refused.
          Add it in the Supabase SQL editor:{' '}
          <code>
            insert into public.site_owners (email) values ('{session.user.email}');
          </code>
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-label-caps text-label-caps uppercase text-on-primary"
        >
          <Icon name="add_photo_alternate" className="text-[18px]" />
          Add photos
        </button>
        {reading > 0 && (
          <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
            Reading {reading} {reading === 1 ? 'file' : 'files'}… HEIC takes a moment
          </span>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        hidden
        onChange={(e) => {
          void accept(e.target.files);
          e.target.value = '';
        }}
      />

      <p className="font-body-md text-sm text-on-surface-variant">
        Each photo is filed by the time it was taken — and when the camera recorded no
        time zone, the clock is read in the zone of wherever this journey says you
        were. Pick a city to override that — required for a photo whose file carries
        no capture time. HEIC is converted to JPEG in the browser so it displays
        everywhere.
      </p>

      {pending.length > 0 && (
        <>
          <ul className="flex flex-wrap gap-stack-sm">
            {pending.map((item, i) => {
              const placement = resolve(item);
              const blocked = unfiled(item);
              return (
              <li key={item.preview} className={`w-44 ${blocked ? 'opacity-70' : ''}`}>
                <img
                  src={item.preview}
                  alt=""
                  className={`h-28 w-44 rounded-lg object-cover shadow-sm ${
                    blocked ? 'grayscale ring-2 ring-error' : ''
                  }`}
                />
                <p className="mt-1 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
                  {item.naiveLocal ? item.naiveLocal.replace('T', ' ') : 'No capture time'}
                </p>
                {item.converted && (
                  <p className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant/70">
                    Converted from HEIC
                  </p>
                )}
                <select
                  value={item.chosen}
                  onChange={(e) =>
                    setPending((p) =>
                      p.map((x, j) => (j === i ? { ...x, chosen: e.target.value } : x)),
                    )
                  }
                  aria-label="Where was this taken?"
                  className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1 font-body-md text-[12px] text-on-surface"
                >
                  <option value="">Auto — from the timestamp</option>
                  {choices.map((place) => (
                    <option key={place.id} value={place.id}>
                      {place.name}
                      {place.code ? ` (${place.code})` : ''}
                    </option>
                  ))}
                </select>

                <p
                  className={`mt-1 font-body-md text-[11px] leading-tight ${
                    blocked ? 'text-error' : 'text-on-surface-variant'
                  }`}
                >
                  {placement.basis === 'unplaced'
                    ? 'No capture time in the file — pick a city to place it'
                    : basisLabel(placement)}
                </p>
                <textarea
                  value={item.caption}
                  onChange={(e) =>
                    setPending((p) =>
                      p.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)),
                    )
                  }
                  rows={2}
                  placeholder="Say something about it…"
                  aria-label="Note for this photo"
                  className="mt-1 w-full resize-y rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1 font-body-md text-[12px] text-on-surface"
                />
                <button
                  type="button"
                  onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                  className="mt-1 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant underline"
                >
                  Remove
                </button>
              </li>
              );
            })}
          </ul>
          {rejected.length > 0 && (
            <p className="font-body-md text-sm text-on-surface-variant">
              {rejected.length === 1 ? 'One photo' : `${rejected.length} photos`} could not
              be filed: either taken outside {journey.startDate} — {journey.endDate}, or
              carrying no capture time at all. Pick a city to add{' '}
              {rejected.length === 1 ? 'it' : 'them'} anyway.
            </p>
          )}
          <button
            type="button"
            onClick={() => void commit()}
            disabled={busy || accepted.length === 0}
            className="self-start rounded-full bg-primary px-6 py-2 font-label-caps text-label-caps uppercase text-on-primary disabled:opacity-50"
          >
            {busy ? 'Uploading…' : `Upload ${accepted.length}`}
          </button>
          {accepted.length === 0 && (
            <p className="font-body-md text-sm text-error">
              Nothing to upload — none of these can be placed on their own. Pick a city
              for one to add it anyway.
            </p>
          )}
        </>
      )}

      {message && (
        <p className="whitespace-pre-wrap rounded-lg bg-error-container px-3 py-2 font-body-md text-sm text-on-error-container">
          {message}
        </p>
      )}
    </div>
  );
}
