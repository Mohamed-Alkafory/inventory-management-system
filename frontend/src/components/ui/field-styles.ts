import { cn } from "../../lib/cn";

const fieldBase =
  "block w-full rounded-control border bg-white px-3 py-2.5 text-sm text-ink placeholder:text-slate-400 transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

/** Shared look for Input, Select and Textarea. */
export function fieldClass(invalid?: boolean, className?: string) {
  return cn(
    fieldBase,
    invalid
      ? "border-danger-600 focus:border-danger-600 focus:ring-danger-600/20"
      : "border-line focus:border-primary-500 focus:ring-primary-500/20",
    className,
  );
}
