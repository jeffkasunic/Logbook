// All dates are handled as ISO strings (YYYY-MM-DD) and computed in UTC so
// that daylight-saving shifts never move a day.

// Quarters follow the ISO week-numbering year: Q1 starts on the Monday of the
// week containing Jan 4, and each quarter is 13 weeks. In years with 53 ISO
// weeks (e.g. 2026, 2032), Q4 takes the extra week, so the next year still
// starts on its ISO week 1.

/** The parts of a quarter that determine its dates. */
type QuarterSpan = { year: number; quarter: number; startDate: string };

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);
}

/** Today's date in the viewer's local time zone. */
export function todayISO(): string {
  const now = new Date();
  const local = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  return toISO(local);
}

/** Monday of ISO week 1 of a year: the week that contains Jan 4. */
export function isoYearStart(year: number): string {
  const jan4 = `${year}-01-04`;
  return addDays(jan4, -((parseISO(jan4).getUTCDay() + 6) % 7));
}

export function isoWeeksInYear(year: number): number {
  return daysBetween(isoYearStart(year), isoYearStart(year + 1)) / 7;
}

/** The ISO-calendar quarter containing a date: its year, number (1–4) and Monday start. */
export function quarterOf(iso: string): { year: number; quarter: number; startDate: string } {
  let year = Number(iso.slice(0, 4));
  if (iso < isoYearStart(year)) year--;
  else if (iso >= isoYearStart(year + 1)) year++;
  const week = Math.floor(daysBetween(isoYearStart(year), iso) / 7);
  const quarter = Math.min(4, Math.floor(week / 13) + 1); // week 53 belongs to Q4
  return { year, quarter, startDate: addDays(isoYearStart(year), (quarter - 1) * 91) };
}

/** 13, or 14 for Q4 of a 53-week year. */
export function quarterWeeks(q: QuarterSpan): number {
  return q.quarter === 4 && isoWeeksInYear(q.year) === 53 ? 14 : 13;
}

export function quarterDays(q: QuarterSpan): number {
  return quarterWeeks(q) * 7;
}

export function inQuarter(q: QuarterSpan, iso: string): boolean {
  const i = daysBetween(q.startDate, iso);
  return i >= 0 && i < quarterDays(q);
}

export function quarterDates(q: QuarterSpan): string[] {
  return Array.from({ length: quarterDays(q) }, (_, i) => addDays(q.startDate, i));
}

/** 0-based week index of a date within its quarter, or -1 if outside. */
export function weekIndexOf(q: QuarterSpan, iso: string): number {
  return inQuarter(q, iso) ? Math.floor(daysBetween(q.startDate, iso) / 7) : -1;
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function weekday(iso: string): string {
  return WEEKDAY[parseISO(iso).getUTCDay()];
}

export function shortDate(iso: string): string {
  const d = parseISO(iso);
  return `${MONTH[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function longDate(iso: string): string {
  const d = parseISO(iso);
  return `${WEEKDAY[d.getUTCDay()]}, ${MONTH[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function weekRange(startDate: string, weekIdx: number): string {
  const a = addDays(startDate, weekIdx * 7);
  const b = addDays(a, 6);
  return `${shortDate(a)} – ${shortDate(b)}`;
}
