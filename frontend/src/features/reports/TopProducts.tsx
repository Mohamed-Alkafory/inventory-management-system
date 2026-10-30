import { formatInt, formatMoney } from "./format";
import { useTopProducts } from "./hooks";
import Panel from "./Panel";
import type { DateRange } from "./types";

export default function TopProducts({ range, className = "" }: { range: DateRange; className?: string }) {
  const q = useTopProducts(range);
  const top = Math.max(...(q.data ?? []).map((p) => p.revenue), 0);

  return (
    <Panel title="Top Products" subtitle="Best sellers by revenue in the selected period" query={q} className={className}>
      {q.data && q.data.length === 0 ? (
        <p className="flex h-40 items-center justify-center text-sm text-[#6B7280]">No products sold in this period.</p>
      ) : (
        <ol className="divide-y divide-[#F3F4F6]" aria-label="Top products">
          {q.data?.map((p, i) => (
            <li key={p.id ?? p.name} className="flex items-center gap-4 py-3">
              <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FFF1EB] text-xs font-bold text-[#FF5615]">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-[#111827]">{p.name}</p>
                  <p className="shrink-0 text-sm font-bold text-[#111827]">{formatMoney(p.revenue)}</p>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 text-xs text-[#6B7280]">
                  <span>{p.sku}</span>
                  <span>{formatInt(p.units)} sold</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F3F4F6]" aria-hidden="true">
                  <div className="h-full rounded-full bg-[#FF5615]" style={{ width: `${top > 0 ? (p.revenue / top) * 100 : 0}%` }} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
