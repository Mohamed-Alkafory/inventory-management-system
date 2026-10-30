import { useEffect, useId, useRef, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import {
  MAX_RANGE_DAYS,
  PRESETS,
  daysIn,
  formatRange,
  isValidISO,
  sameRange,
  todayISO,
} from "../../lib/dateRange";
import type { DateRange } from "../../lib/dateRange";

const field =
  "h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-2 text-sm text-[#111827] focus:border-[#FF5615] focus:outline-none focus:ring-2 focus:ring-[#FF5615]/25";

type Props = {
  value: DateRange;
  onChange: (r: DateRange) => void;
  /** The largest range the API accepts, both ends included. */
  maxDays?: number;
  /** A message returned by the API for the applied range. */
  serverError?: string | null;
};

/** Presets plus a custom range. Never applies an inverted or oversized range. */
export default function DateRangePicker({ value, onChange, maxDays = MAX_RANGE_DAYS, serverError }: Props) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState(value.to);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const errorId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) {
      setFrom(value.from); // start from the range currently applied
      setTo(value.to);
    }
    setOpen((o) => !o);
  };

  const apply = (r: DateRange) => {
    onChange(r);
    setOpen(false);
  };

  const today = todayISO();
  const complete = isValidISO(from) && isValidISO(to);
  const reversed = complete && from > to;
  const tooLong = complete && !reversed && daysIn({ from, to }) > maxDays;
  const invalid = reversed || tooLong;
  const validation = reversed
    ? "The start date must be on or before the end date."
    : tooLong
      ? `Date range must not exceed ${maxDays} days.`
      : null;

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-describedby={serverError ? errorId : undefined}
        aria-label={`Date range: ${formatRange(value)}`}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-[#111827] hover:bg-[#F9FAFB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615]"
      >
        <Calendar className="h-4 w-4 text-[#FF5615]" />
        <span>{formatRange(value)}</span>
        <ChevronDown className="h-4 w-4 text-[#6B7280]" />
      </button>

      {serverError && (
        <p id={errorId} role="alert" className="mt-1 max-w-xs text-xs font-medium text-[#DC2626]">
          {serverError}
        </p>
      )}

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Choose a date range"
          className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-lg shadow-black/10"
        >
          <ul className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((p) => {
              const r = p.range();
              const active = sameRange(r, value);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => apply(r)}
                    aria-pressed={active}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615] ${
                      active ? "bg-[#FF5615] text-white" : "bg-[#F9FAFB] text-[#374151] hover:bg-[#FFF1EB] hover:text-[#FF5615]"
                    }`}
                  >
                    {p.label}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 border-t border-[#F3F4F6] pt-3">
            <p className="text-xs font-semibold text-[#6B7280]">Custom range</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-[#6B7280]">
                From
                <input
                  type="date"
                  value={from}
                  max={to && isValidISO(to) ? (to < today ? to : today) : today}
                  onChange={(e) => setFrom(e.target.value)}
                  className={`${field} mt-1`}
                />
              </label>
              <label className="text-xs font-semibold text-[#6B7280]">
                To
                <input
                  type="date"
                  value={to}
                  min={isValidISO(from) ? from : undefined}
                  max={today}
                  onChange={(e) => setTo(e.target.value)}
                  className={`${field} mt-1`}
                />
              </label>
            </div>
            <p className="mt-2 text-[11px] text-[#9CA3AF]">Up to {maxDays} days.</p>
            {validation && (
              <p role="alert" className="mt-2 text-xs font-medium text-[#DC2626]">
                {validation}
              </p>
            )}
            <button
              type="button"
              disabled={!complete || invalid}
              onClick={() => apply({ from, to })}
              className="mt-3 h-9 w-full rounded-lg bg-[#FF5615] text-sm font-semibold text-white hover:bg-[#E84A0E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
