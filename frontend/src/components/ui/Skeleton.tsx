import { cn } from "../../lib/cn";

type Props = {
  className?: string;
};

/** Grey placeholder block. Size it with className (e.g. "h-4 w-32"). */
export function Skeleton({ className }: Props) {
  return (
    <div
      className={cn("animate-pulse rounded-control bg-slate-200 motion-reduce:animate-none", className)}
      aria-hidden="true"
    />
  );
}

/** A few lines of placeholder text; the last line is shorter. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
