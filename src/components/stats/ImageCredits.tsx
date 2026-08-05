import { useState } from 'react';
import credits from '../../data/image-credits.json';
import { useAtlas } from '../../hooks/useAtlas';
import { Icon } from '../ui/Icon';

interface Credit {
  file: string;
  author: string;
  licence: string;
  source: string;
  article: string;
}

const CREDITS = credits as Record<string, Credit>;

/**
 * Every city photo comes from Wikimedia Commons under a free licence.
 * CC BY and CC BY-SA both require naming the author, so this is not optional.
 */
export function ImageCredits() {
  const { data } = useAtlas();
  const [open, setOpen] = useState(false);

  const rows = data.places
    .filter((p) => p.code && CREDITS[p.code])
    .map((p) => ({ place: p, credit: CREDITS[p.code as string] }))
    .sort((a, b) => a.place.name.localeCompare(b.place.name));

  if (!rows.length) return null;

  return (
    <section className="rounded-xl bg-surface-container-low p-stack-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <span className="flex items-center gap-2">
          <Icon name="photo_library" className="text-on-surface-variant" />
          <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
            Photo credits — {rows.length} cities, Wikimedia Commons
          </span>
        </span>
        <Icon
          name={open ? 'expand_less' : 'expand_more'}
          className="text-on-surface-variant"
        />
      </button>

      {open && (
        <div className="mt-stack-md overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className="pb-2 pr-4 text-left font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
                  City
                </th>
                <th className="pb-2 pr-4 text-left font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
                  Photographer
                </th>
                <th className="pb-2 pr-4 text-left font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
                  Licence
                </th>
                <th className="pb-2 text-left font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
                  File
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ place, credit }) => (
                <tr key={place.id} className="border-b border-outline-variant/40">
                  <td className="py-2 pr-4 text-on-surface">
                    {place.name}{' '}
                    <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">
                      {place.code}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-on-surface-variant">{credit.author}</td>
                  <td className="py-2 pr-4 text-on-surface-variant">{credit.licence}</td>
                  <td className="py-2">
                    <a
                      href={credit.source}
                      target="_blank"
                      rel="noreferrer"
                      className="text-on-surface-variant underline decoration-outline-variant underline-offset-2 hover:text-on-surface"
                    >
                      {credit.file}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
