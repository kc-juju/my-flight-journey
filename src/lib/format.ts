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

/** "04 Oct 2025" from an ISO date or date-time. */
export function formatDayDate(iso?: string): string {
  if (!iso) return '';
  const { y, m, d } = parts(iso);
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`;
}

/**
 * Calendar days between departure and arrival.
 *
 * Usually 0 or 1, but an eastbound Pacific crossing can land on the same date
 * at an earlier clock time, which is why the date is worth printing.
 */
export function dayOffset(departure?: string, arrival?: string): number {
  if (!departure || !arrival) return 0;
  const a = Date.parse(`${departure.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${arrival.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
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

/**
 * How a delay should read. Early and roughly-on-time are worth distinguishing
 * from late; an hour late is worth distinguishing from five minutes.
 */
export function punctuality(minutes?: number): {
  label: string;
  tone: 'early' | 'ontime' | 'slight' | 'late';
  colour: string;
} | null {
  if (minutes == null) return null;
  if (minutes <= -5) return { label: `${Math.abs(minutes)}m early`, tone: 'early', colour: '#2f6b46' };
  if (minutes < 15) return { label: minutes <= 0 ? 'On time' : `${minutes}m late`, tone: 'ontime', colour: '#5e5e5b' };
  if (minutes < 60) return { label: `${minutes}m late`, tone: 'slight', colour: '#a17f3b' };
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return { label: `${h}h${m ? ` ${m}m` : ''} late`, tone: 'late', colour: '#ba1a1a' };
}

export const STATUS_LABEL = {
  completed: 'Verified journey',
  planned: 'Booked',
  bucket: 'Bucket list',
} as const;
