import type { DateRange } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");
const DAY = 86_400_000;

/** Local calendar day "YYYY-MM-DD" (what <input type="date"> uses). */
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** "YYYY-MM-DD" → a local Date at midnight (no timezone shifts). */
export const fromISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const todayISO = () => toISO(new Date());

// Calendar arithmetic on plain date labels (UTC day numbers → immune to DST).
export const dayNumber = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
};
export const isoOfDayNumber = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => isoOfDayNumber(dayNumber(iso) + n);
/** Number of days in the range, both ends included. */
export const daysIn = (r: DateRange) => dayNumber(r.to) - dayNumber(r.from) + 1;

export const isValidISO = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && toISO(fromISO(s)) === s;

export function parseRange(from: string | null, to: string | null): DateRange | null {
  return isValidISO(from) && isValidISO(to) && from <= to ? { from, to } : null;
}

export const sameRange = (a: DateRange, b: DateRange) => a.from === b.from && a.to === b.to;

export interface Preset {
  id: string;
  label: string;
  range: () => DateRange;
}

export const PRESETS: Preset[] = [
  { id: "7d", label: "Last 7 days", range: () => ({ from: addDays(todayISO(), -6), to: todayISO() }) },
  { id: "30d", label: "Last 30 days", range: () => ({ from: addDays(todayISO(), -29), to: todayISO() }) },
  { id: "90d", label: "Last 90 days", range: () => ({ from: addDays(todayISO(), -89), to: todayISO() }) },
  {
    id: "this-month",
    label: "This month",
    range: () => {
      const t = new Date();
      return { from: toISO(new Date(t.getFullYear(), t.getMonth(), 1)), to: toISO(t) };
    },
  },
  {
    id: "last-month",
    label: "Last month",
    range: () => {
      const t = new Date();
      return { from: toISO(new Date(t.getFullYear(), t.getMonth() - 1, 1)), to: toISO(new Date(t.getFullYear(), t.getMonth(), 0)) };
    },
  },
];

export const DEFAULT_RANGE = (): DateRange => PRESETS[1].range();

const medium = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
export const formatDay = (iso: string) => medium.format(fromISO(iso));
export const formatRange = (r: DateRange) => `${formatDay(r.from)} – ${formatDay(r.to)}`;
