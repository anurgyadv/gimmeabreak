// Fixed demo month: November 2026. All helpers use plain string/integer
// arithmetic on YYYY-MM-DD values — never `new Date(iso)` — so results are
// immune to local-timezone parsing surprises.

export const DEMO_YEAR = 2026;
export const DEMO_MONTH = 11;
export const DAYS_IN_MONTH = 30;
export const MIN_DATE = '2026-11-01';
export const MAX_DATE = '2026-11-30';

// Nov 1 2026 is a Sunday. Monday-first weekday index (Mon=0..Sun=6) for day 1.
const NOV_1_WEEKDAY_MONDAY_FIRST = 6;

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_LONG = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export function dayNumberToISO(day: number): string {
  return `2026-11-${String(day).padStart(2, '0')}`;
}

export function isoToDayNumber(iso: string): number {
  return Number(iso.slice(8, 10));
}

export function isValidNovemberISO(iso: string): boolean {
  return /^2026-11-(0[1-9]|[12]\d|30)$/.test(iso);
}

export function weekdayIndex(day: number): number {
  return (NOV_1_WEEKDAY_MONDAY_FIRST + (day - 1)) % 7;
}

export function weekdayShort(iso: string): string {
  return WEEKDAY_SHORT[weekdayIndex(isoToDayNumber(iso))];
}

export function weekdayLong(iso: string): string {
  return WEEKDAY_LONG[weekdayIndex(isoToDayNumber(iso))];
}

export function formatDateLong(iso: string): string {
  const day = isoToDayNumber(iso);
  return `${weekdayShort(iso)}, ${day} Nov`;
}

export function formatDateFull(iso: string): string {
  const day = isoToDayNumber(iso);
  return `${weekdayLong(iso)} ${day} November 2026`;
}

export function formatRangeShort(start: string, end: string): string {
  if (start === end) return formatDateLong(start);
  const startDay = isoToDayNumber(start);
  const endDay = isoToDayNumber(end);
  return `${weekdayShort(start)} ${startDay} – ${weekdayShort(end)} ${endDay} Nov`;
}

// Number of blank lead-in cells so day 1 lands in the correct Monday-first column.
export function leadingBlankCount(): number {
  return NOV_1_WEEKDAY_MONDAY_FIRST;
}

export function addDays(iso: string, delta: number): string | null {
  const day = isoToDayNumber(iso) + delta;
  if (day < 1 || day > DAYS_IN_MONTH) return null;
  return dayNumberToISO(day);
}

export function normalizeRange(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

export function isInRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end;
}

export function clampToNovember(iso: string): string {
  if (iso < MIN_DATE) return MIN_DATE;
  if (iso > MAX_DATE) return MAX_DATE;
  return iso;
}
