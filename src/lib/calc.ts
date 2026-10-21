import type { DayEntry, Quarter } from '../types';
import { addDays, quarterDates, quarterWeeks } from './dates';

/** Sum of all category hours for a day (the "Total" column). */
export function dayTotal(entry: DayEntry | undefined, categoryIds?: string[]): number {
  if (!entry?.hours) return 0;
  let sum = 0;
  for (const [id, h] of Object.entries(entry.hours)) {
    if (!categoryIds || categoryIds.includes(id)) sum += h;
  }
  return sum;
}

/** Total ÷ Goal (the "% (Day)" column). Null when nothing was logged. */
export function dayPct(entry: DayEntry | undefined, categoryIds?: string[]): number | null {
  const total = dayTotal(entry, categoryIds);
  if (!entry || total === 0 || !entry.goal) return null;
  return total / entry.goal;
}

/** Hours for one category in one week (the weekly sheet's "Done" cells). */
export function weekHours(q: Quarter, weekIdx: number, categoryId: string): number {
  let sum = 0;
  const start = addDays(q.startDate, weekIdx * 7);
  for (let i = 0; i < 7; i++) {
    sum += q.days[addDays(start, i)]?.hours?.[categoryId] ?? 0;
  }
  return sum;
}

export interface WeeklyRow {
  categoryId: string;
  goal: number;
  weeks: number[];
  total: number;
}

export function weeklyTable(q: Quarter): WeeklyRow[] {
  return q.categories.map((c) => {
    const weeks = Array.from({ length: quarterWeeks(q) }, (_, w) => weekHours(q, w, c.id));
    return { categoryId: c.id, goal: c.weeklyGoal, weeks, total: weeks.reduce((a, b) => a + b, 0) };
  });
}

export function weeklyGoalTotal(q: Quarter): number {
  return q.categories.reduce((a, c) => a + c.weeklyGoal, 0);
}

export interface QuarterStats {
  totalHours: number;
  daysLogged: number;
  goalHours: number;
  avgPerLoggedDay: number;
  daysMetGoal: number;
}

export function quarterStats(q: Quarter, upTo?: string): QuarterStats {
  const ids = q.categories.map((c) => c.id);
  let totalHours = 0;
  let daysLogged = 0;
  let goalHours = 0;
  let daysMetGoal = 0;
  for (const d of quarterDates(q)) {
    if (upTo && d > upTo) break;
    const e = q.days[d];
    goalHours += e?.goal ?? q.defaultDailyGoal;
    const t = dayTotal(e, ids);
    if (t > 0) {
      daysLogged++;
      totalHours += t;
      if (e && e.goal && t >= e.goal) daysMetGoal++;
    }
  }
  return {
    totalHours,
    daysLogged,
    goalHours,
    avgPerLoggedDay: daysLogged ? totalHours / daysLogged : 0,
    daysMetGoal,
  };
}

/** Consecutive days with any hours logged, ending today (or yesterday if today is still empty). */
export function currentStreak(q: Quarter, today: string): number {
  const ids = q.categories.map((c) => c.id);
  let d = today;
  if (dayTotal(q.days[d], ids) === 0) d = addDays(d, -1);
  let n = 0;
  while (d >= q.startDate && dayTotal(q.days[d], ids) > 0) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

// ---- number formatting & parsing ----

export function fmtHours(n: number | null | undefined): string {
  if (n == null || n === 0) return '';
  return Number(n.toFixed(2)).toString();
}

export function fmtPct(n: number | null | undefined): string {
  if (n == null) return '';
  return `${Math.round(n * 100)}%`;
}

/**
 * Parse what someone types into an hours cell.
 * Accepts "1.5", "1,5", "1:30", "90m", "1h30", "1h 30m", "45 min". Empty → null.
 */
export function parseHours(raw: string): number | null | 'invalid' {
  const s = raw.trim().toLowerCase().replace(',', '.');
  if (s === '') return null;
  let m = s.match(/^(\d+):(\d{1,2})$/);
  if (m) return round2(Number(m[1]) + Number(m[2]) / 60);
  m = s.match(/^(\d+(?:\.\d+)?)\s*(?:m|min|mins|minutes)$/);
  if (m) return round2(Number(m[1]) / 60);
  m = s.match(/^(\d+(?:\.\d+)?)\s*h(?:rs?|ours?)?\s*(?:(\d+)\s*(?:m|min|mins)?)?$/);
  if (m) return round2(Number(m[1]) + (m[2] ? Number(m[2]) / 60 : 0));
  if (/^\d*\.?\d+$/.test(s)) return round2(Number(s));
  return 'invalid';
}

export function parseNumber(raw: string): number | null | 'invalid' {
  const s = raw.trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : 'invalid';
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
