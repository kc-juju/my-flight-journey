import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Journey, Place } from '../../types/journey';
import { useAuth } from '../../hooks/useSupabase';
import {
  deletePhoto,
  listPhotos,
  readExifTime,
  uploadPhoto,
  type JourneyPhoto,
} from '../../lib/photos';
import { basisLabel, placePhoto, type PhotoPlacement } from '../../lib/photoPlacement';
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
      const placement = placePhoto(journey, placesById, {
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

  if (!photos.length) return null;

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
            className="group relative h-32 w-32 overflow-hidden rounded-xl bg-surface-container shadow-md sm:h-40 sm:w-40"
          >
            <img
              src={photo.url}
              alt={photo.caption ?? 'Journey photo'}
              loading="lazy"
              className="h-full w-full object-cover"
            />
            {photo.taken_local && (
              <span className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-primary/85 to-transparent px-2 pb-1 pt-4 font-label-caps text-[10px] uppercase tracking-widest text-on-primary">
                {photo.taken_local.slice(11)}
                {photo.time_basis === 'itinerary' && (
                  <span title="Read in the local zone of where you were"> ·&nbsp;local</span>
                )}
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
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

interface PendingPhoto {
  file: File;
  preview: string;
  placement: PhotoPlacement;
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
  const { session, signIn, signOut, loading } = useAuth();
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const accept = async (files: FileList | null) => {
    if (!files?.length) return;
    const next: PendingPhoto[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const exif = await readExifTime(file);
      next.push({
        file,
        preview: URL.createObjectURL(file),
        naiveLocal: exif.naiveLocal,
        offsetMinutes: exif.offsetMinutes,
        placement: placePhoto(journey, placesById, {
          naiveLocal: exif.naiveLocal,
          offsetMinutes: exif.offsetMinutes,
        }),
      });
    }
    setPending((p) => [...p, ...next]);
  };

  const accepted = pending.filter((p) => p.placement.basis !== 'outside-journey');
  const rejected = pending.filter((p) => p.placement.basis === 'outside-journey');

  const commit = async () => {
    setBusy(true);
    setMessage(null);
    for (const item of accepted) {
      const { error } = await uploadPhoto({
        file: item.file,
        journeySlug: journey.slug,
        takenLocal: item.naiveLocal,
        offsetMinutes: item.offsetMinutes,
        instant: item.placement.instant,
        basis: item.placement.basis,
        placeId: item.placement.place?.id,
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

  if (!session) {
    return (
      <div className="rounded-xl border border-dashed border-outline-variant p-stack-md">
        <p className="mb-stack-sm font-body-md text-sm text-on-surface-variant">
          Photos are public; adding and removing them is limited to the site owner.
          Sign in with the owner address to manage this journey's photos.
        </p>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const error = await signIn(email);
            setMessage(error ?? 'Check your inbox for the sign-in link.');
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md text-sm text-on-surface"
          />
          <button
            type="submit"
            className="rounded-full bg-primary px-5 py-2 font-label-caps text-label-caps uppercase text-on-primary"
          >
            Email me a link
          </button>
        </form>
        {message && (
          <p className="mt-stack-sm font-body-md text-sm text-on-surface-variant">{message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-stack-sm rounded-xl border border-dashed border-outline-variant p-stack-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-label-caps text-label-caps uppercase text-on-primary"
        >
          <Icon name="add_photo_alternate" className="text-[18px]" />
          Add photos
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant hover:text-on-surface"
        >
          Sign out
        </button>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void accept(e.target.files);
          e.target.value = '';
        }}
      />

      <p className="font-body-md text-sm text-on-surface-variant">
        Each photo is filed by the time it was taken. When the camera did not record a
        time zone, the clock is read in the zone of wherever this journey says you were.
      </p>

      {pending.length > 0 && (
        <>
          <ul className="flex flex-wrap gap-stack-sm">
            {pending.map((item, i) => (
              <li
                key={item.preview}
                className={`w-40 ${
                  item.placement.basis === 'outside-journey' ? 'opacity-60' : ''
                }`}
              >
                <img
                  src={item.preview}
                  alt=""
                  className={`h-28 w-40 rounded-lg object-cover shadow-sm ${
                    item.placement.basis === 'outside-journey'
                      ? 'grayscale ring-2 ring-error'
                      : ''
                  }`}
                />
                <p className="mt-1 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
                  {item.naiveLocal ? item.naiveLocal.replace('T', ' ') : 'No capture time'}
                </p>
                <p
                  className={`font-body-md text-[11px] leading-tight ${
                    item.placement.basis === 'outside-journey'
                      ? 'text-error'
                      : 'text-on-surface-variant'
                  }`}
                >
                  {basisLabel(item.placement)}
                </p>
                <button
                  type="button"
                  onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                  className="mt-1 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          {rejected.length > 0 && (
            <p className="font-body-md text-sm text-on-surface-variant">
              {rejected.length === 1 ? 'One photo was' : `${rejected.length} photos were`}{' '}
              taken outside {journey.startDate} — {journey.endDate}, so{' '}
              {rejected.length === 1 ? 'it is' : 'they are'} not being added.
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
        </>
      )}

      {message && <p className="font-body-md text-sm text-error">{message}</p>}
    </div>
  );
}
