/**
 * Three circles that everybody recognises.
 *
 * No icon set ships this, and no icon set needs to: a head and two ears at
 * the right proportions is the whole mark. Drawn rather than fetched so it
 * inherits the colour around it and costs nothing.
 */
export function MickeyEars({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
      focusable="false"
    >
      <circle cx="5.6" cy="6.2" r="4.1" />
      <circle cx="18.4" cy="6.2" r="4.1" />
      <circle cx="12" cy="15.2" r="7" />
    </svg>
  );
}
