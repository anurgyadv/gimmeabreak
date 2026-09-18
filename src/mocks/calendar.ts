import type { FeasibilityStatus, LeaveDayFeasibility } from '@/lib/types';

/**
 * Deterministic synthetic November 2026 feasibility calendar.
 *
 * Every date's score is a pure function of the calendar date, so the same
 * inputs always produce the same outputs (no randomness, no clock reads).
 * Two demo scenarios are guaranteed by explicit override rather than by the
 * generic weekday formula:
 *  - Any range containing 18 Nov 2026 is pinned to score 31 / "difficult"
 *    (senior coverage would drop from two clinicians to one).
 *  - 23-25 Nov 2026 is pinned to score 94 / "easy" (no cover required).
 * All other dates/ranges are derived consistently from the same per-day
 * formula so the calendar and range evaluation never disagree.
 */

export const NOVEMBER_START = '2026-11-01';
export const NOVEMBER_END = '2026-11-30';
export const HERO_LIMITING_DATE = '2026-11-18';
export const ALTERNATE_WINDOW_DATES = ['2026-11-23', '2026-11-24', '2026-11-25'];

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isWellFormedDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

export function isWithinNovember2026(value: string): boolean {
  return isWellFormedDate(value) && value >= NOVEMBER_START && value <= NOVEMBER_END;
}

function toUtcDate(value: string): Date {
  const match = DATE_PATTERN.exec(value);
  if (!match) throw new Error(`Invalid date: ${value}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function toDateString(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(value: string, amount: number): string {
  const dt = toUtcDate(value);
  dt.setUTCDate(dt.getUTCDate() + amount);
  return toDateString(dt);
}

export function enumerateDates(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatDateLabel(value: string): string {
  const match = DATE_PATTERN.exec(value);
  if (!match) return value;
  const day = Number(match[3]);
  const month = Number(match[2]) - 1;
  return `${day} ${MONTH_NAMES[month]}`;
}

// Base weekday scores, index 0 = Sunday ... 6 = Saturday.
const WEEKDAY_BASE = [90, 72, 55, 40, 64, 82, 92];

function weekOfMonth(day: number): number {
  return Math.floor((day - 1) / 7);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function baseDayScore(value: string): number {
  const dt = toUtcDate(value);
  const weekday = dt.getUTCDay();
  const day = dt.getUTCDate();
  const adjustment = (weekOfMonth(day) - 2) * 3;
  return clampScore(WEEKDAY_BASE[weekday] + adjustment);
}

export function classifyScore(score: number): FeasibilityStatus {
  if (score >= 80) return 'easy';
  if (score >= 60) return 'good';
  if (score >= 40) return 'cover-needed';
  return 'difficult';
}

function statusLabel(status: FeasibilityStatus): string {
  switch (status) {
    case 'easy': return 'Easy';
    case 'good': return 'Good';
    case 'cover-needed': return 'Cover needed';
    case 'difficult': return 'Difficult';
  }
}

function primaryReasonFor(date: string, status: FeasibilityStatus): string | undefined {
  if (date === HERO_LIMITING_DATE) return 'Minimum senior coverage';
  if (ALTERNATE_WINDOW_DATES.includes(date)) return undefined;
  if (status === 'difficult') return 'Elevated staffing pressure';
  if (status === 'cover-needed') return 'Tight staffing margin';
  return undefined;
}

/** Per-day feasibility, applying the two guaranteed-scenario overrides. */
export function dayFeasibility(date: string): LeaveDayFeasibility {
  let score: number;
  let status: FeasibilityStatus;

  if (date === HERO_LIMITING_DATE) {
    score = 31;
    status = 'difficult';
  } else if (ALTERNATE_WINDOW_DATES.includes(date)) {
    score = 94;
    status = 'easy';
  } else {
    score = baseDayScore(date);
    status = classifyScore(score);
  }

  return {
    date,
    score,
    status,
    label: statusLabel(status),
    primaryReason: primaryReasonFor(date, status),
  };
}

export function buildCalendar(): LeaveDayFeasibility[] {
  return enumerateDates(NOVEMBER_START, NOVEMBER_END).map(dayFeasibility);
}

export interface RangeScore {
  score: number;
  status: FeasibilityStatus;
  limitingDate: string;
}

/**
 * The single source of truth for how a date range scores. Used by both leave
 * evaluation and window search so results always agree with the calendar.
 */
export function scoreRange(startDate: string, endDate: string): RangeScore {
  const dates = enumerateDates(startDate, endDate);

  if (dates.includes(HERO_LIMITING_DATE)) {
    return { score: 31, status: 'difficult', limitingDate: HERO_LIMITING_DATE };
  }

  if (dates.every((d) => ALTERNATE_WINDOW_DATES.includes(d))) {
    return { score: 94, status: 'easy', limitingDate: dates[0] };
  }

  let limiting = dates[0];
  let worst = dayFeasibility(limiting);
  for (const d of dates.slice(1)) {
    const feasibility = dayFeasibility(d);
    if (feasibility.score < worst.score) {
      worst = feasibility;
      limiting = d;
    }
  }

  return { score: worst.score, status: worst.status, limitingDate: limiting };
}
