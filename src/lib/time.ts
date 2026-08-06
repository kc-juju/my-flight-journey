/** Reading a local clock in a named zone, without leaking the browser's own. */

/** Minutes that a zone is offset from UTC at a given instant. */
export function zoneOffsetMinutes(timeZone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(at).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  );
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === '24' ? '00' : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUTC - at.getTime()) / 60_000);
}

/** Interpret a naive local date-time ("2025-10-06T14:03") in a named zone. */
export function localToInstant(naive: string, timeZone: string): Date {
  const guess = new Date(`${naive}Z`);
  // Two passes settle DST boundaries.
  let offset = zoneOffsetMinutes(timeZone, guess);
  let instant = new Date(guess.getTime() - offset * 60_000);
  offset = zoneOffsetMinutes(timeZone, instant);
  instant = new Date(guess.getTime() - offset * 60_000);
  return instant;
}
