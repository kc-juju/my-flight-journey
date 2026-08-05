import type { TransportMode } from '../types/journey';

const NUMBER = new Intl.NumberFormat('en-US');

export const formatNumber = (n: number) => NUMBER.format(n);

/** "1 day" / "2 days" — the prototype said "1 days". */
export const plural = (n: number, one: string, many = `${one}s`) =>
  `${NUMBER.format(n)} ${n === 1 ? one : many}`;

export function formatDistance(km: number): string {
  return `${NUMBER.format(Math.round(km))} km`;
}

export function formatDuration(minutes: number): string {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  return m ? `${h}h ${String(m).padStart(2, '0')}m` : `${h}h`;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function parts(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return { y, m, d };
}

/** "Sep 2024" */
export function formatMonthYear(iso: string): string {
  const { y, m } = parts(iso);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "Sep 05 — Sep 19, 2024" */
export function formatDateRange(startIso: string, endIso: string): string {
  const s = parts(startIso);
  const e = parts(endIso);
  const left = `${MONTHS[s.m - 1]} ${String(s.d).padStart(2, '0')}`;
  const right = `${MONTHS[e.m - 1]} ${String(e.d).padStart(2, '0')}`;
  return s.y === e.y ? `${left} — ${right}, ${e.y}` : `${left}, ${s.y} — ${right}, ${e.y}`;
}

/** "14:20" from an ISO local date-time. */
export function formatClock(iso?: string): string {
  return iso ? iso.slice(11, 16) : '—';
}

export const MODE_LABEL: Record<TransportMode, string> = {
  flight: 'Flight',
  train: 'Rail',
  car: 'Road',
  bus: 'Coach',
  ferry: 'Ferry',
  walk: 'On foot',
  surface: 'Overland',
};

/** Material Symbols glyph per transport mode. */
export const MODE_ICON: Record<TransportMode, string> = {
  flight: 'flight_takeoff',
  train: 'train',
  car: 'directions_car',
  bus: 'directions_bus',
  ferry: 'directions_boat',
  walk: 'directions_walk',
  surface: 'more_horiz',
};

/**
 * Route colour per mode. Flights take the prototype's gold; ground transport
 * steps back so a mixed journey reads as one line with texture, not confetti.
 */
export const MODE_COLOR: Record<TransportMode, string> = {
  flight: '#e9c176',
  train: '#5e5e5b',
  car: '#76849f',
  bus: '#a17f3b',
  ferry: '#39475f',
  walk: '#c8c6c2',
  surface: '#b9c7e4',
};

export const STATUS_LABEL = {
  completed: 'Verified journey',
  planned: 'Booked',
  bucket: 'Bucket list',
} as const;
