import { useId } from "react";
import type { ReactNode } from "react";

interface QueryState {
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => unknown;
}

/** A report card: title + body, with its own loading and error (with retry) states. */
export default function Panel({
  title,
  subtitle,
  query,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  query: QueryState;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`rounded-2xl border border-[#E5E7EB] bg-white p-5 ${className}`}>
      <h2 id={id} className="text-base font-bold text-[#111827]">
        {title}
      </h2>
      {subtitle && <p className="mt-0.5 text-xs text-[#6B7280]">{subtitle}</p>}

      <div className="mt-4">
        {query.isPending ? (
          <div role="status" className="flex h-56 items-center justify-center text-sm text-[#6B7280]">
            Loading…
          </div>
        ) : query.isError ? (
          <div role="alert" className="flex h-56 flex-col items-center justify-center text-center text-sm">
            <p className="text-[#DC2626]">Couldn’t load this report.</p>
            <button type="button" onClick={() => query.refetch()} className="mt-1 font-semibold text-[#FF5615] hover:underline">
              Try again
            </button>
          </div>
        ) : (
          <div className={`transition-opacity ${query.isFetching ? "opacity-60" : ""}`} aria-busy={query.isFetching}>
            {children}
          </div>
        )}
      </div>
    </section>
  );
}
