/**
 * Resolve a public asset against the deploy base.
 *
 * On GitHub Pages the site lives under /<repo>/, so a bare "/images/x.jpg"
 * would 404. Vite exposes the configured base as import.meta.env.BASE_URL.
 */
export function asset(path?: string): string | undefined {
  if (!path) return undefined;
  if (/^(https?:)?\/\//.test(path)) return path;
  const base = import.meta.env.BASE_URL || '/';
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
