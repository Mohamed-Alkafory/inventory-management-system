const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");

/** Inclusive date range using local calendar days, "YYYY-MM-DD" (what <input type="date"> uses). */
export interface DateRange {
  from: string;
  to: string;
}

/** The dashboard API accepts at most 92 inclusive days (backend MAX_RANGE_DAYS). */
export const MAX_RANGE_DAYS = 92;

/** Local calendar day "YYYY-MM-DD". */
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "YYYY-MM-DD" -> a local Date at midnight (no timezone shifts). */
export const fromISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const todayISO = () => toISO(new Date());

// Calendar arithmetic on plain date labels (UTC day numbers -> immune to DST).
export const dayNumber = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
};

export const isoOfDayNumber = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => isoOfDayNumber(dayNumber(iso) + n);

/** Number of days in the range, both ends included. */
export const daysIn = (r: DateRange) => dayNumber(r.to) - dayNumber(r.from) + 1;

export const isValidISO = (s: string | null | undefined): s is string =>
  !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && toISO(fromISO(s)) === s;

/** Parse URL values. A too-long range is kept so the server can reject it and its message can be shown. */
export function parseRange(from: string | null, to: string | null): DateRange | null {
  return isValidISO(from) && isValidISO(to) && from <= to ? { from, to } : null;
}

export const sameRange = (a: DateRange, b: DateRange) => a.from === b.from && a.to === b.to;
export const isWithinMaxRange = (r: DateRange) => daysIn(r) <= MAX_RANGE_DAYS;

export interface Preset {
  id: string;
  label: string;
  range: () => DateRange;
}

export const PRESETS: Preset[] = [
  { id: "7d", label: "Last 7 days", range: () => ({ from: addDays(todayISO(), -6), to: todayISO() }) },
  { id: "30d", label: "Last 30 days", range: () => ({ from: addDays(todayISO(), -29), to: todayISO() }) },
  { id: "90d", label: "Last 90 days", range: () => ({ from: addDays(todayISO(), -89), to: todayISO() }) },
];

export const DEFAULT_RANGE = (): DateRange => PRESETS[1].range();

/** Inclusive local days -> the UTC bounds the dashboard/report endpoints expect. */
export const toRangeParams = (r: DateRange): { from: string; to: string } => ({
  from: `${r.from}T00:00:00.000Z`,
  to: `${r.to}T23:59:59.999Z`,
});

export const rangeQueryString = (r: DateRange) => new URLSearchParams(toRangeParams(r)).toString();

const medium = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
export const formatDay = (iso: string) => medium.format(fromISO(iso));
export const formatRange = (r: DateRange) => `${formatDay(r.from)} - ${formatDay(r.to)}`;
