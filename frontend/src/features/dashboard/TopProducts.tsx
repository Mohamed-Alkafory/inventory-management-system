import { EmptyState } from "../../components/ui";
import { formatInt, formatMoney } from "./format";
import { useDashboardTopProducts } from "./hooks";
import WidgetCard from "./WidgetCard";
import type { DateRange } from "./types";

export default function TopProducts({ range }: { range: DateRange }) {
  const query = useDashboardTopProducts(range);
  const top = Math.max(0, ...(query.data ?? []).map((p) => p.revenue));

  return (
    <WidgetCard title="Top products" description="Best sellers by revenue in the selected period" query={query}>
      {query.data && query.data.length === 0 ? (
        <EmptyState
          title="No products sold"
          description="No order lines were recorded in this period."
          className="py-6"
        />
      ) : (
        <ol className="divide-y divide-line" aria-label="Top products">
          {query.data?.map((p, i) => (
            <li key={p.productId} className="flex items-center gap-4 py-3">
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700"
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-ink">{p.productName}</p>
                  <p className="shrink-0 text-sm font-bold tabular-nums text-ink">{formatMoney(p.revenue)}</p>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted">
                  <span>{p.sku}</span>
                  <span>{formatInt(p.quantitySold)} sold</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-primary-500"
                    style={{ width: `${top > 0 ? (p.revenue / top) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </WidgetCard>
  );
}
