import { DollarSign, Package, Receipt, ShoppingCart, TrendingDown, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatChange, formatInt, formatMoney, formatMoneyWhole } from "./format";
import { useSummary } from "./hooks";
import type { DateRange, Kpi } from "./types";

const CARDS: Array<{ key: "totalSales" | "totalOrders" | "averageOrderValue" | "productsSold"; label: string; icon: LucideIcon; format: (n: number) => string }> = [
  { key: "totalSales", label: "Total Sales", icon: DollarSign, format: formatMoneyWhole },
  { key: "totalOrders", label: "Total Orders", icon: ShoppingCart, format: formatInt },
  { key: "averageOrderValue", label: "Avg. Order Value", icon: Receipt, format: formatMoney },
  { key: "productsSold", label: "Total Products Sold", icon: Package, format: formatInt },
];

function Change({ kpi }: { kpi: Kpi }) {
  if (kpi.change === null) return <span className="text-xs text-[#9CA3AF]">No comparison</span>;
  const up = kpi.change >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ${up ? "bg-[#DDF5EA] text-[#1F8F6B]" : "bg-[#FFD6D8] text-[#C53030]"}`}>
        <Icon className="h-3 w-3" />
        {formatChange(kpi.change)}
      </span>
      <span className="text-[#6B7280]">vs previous period</span>
    </span>
  );
}

export default function KpiCards({ range }: { range: DateRange }) {
  const { data, isPending, isError, isFetching, refetch } = useSummary(range);

  if (isError) {
    return (
      <div role="alert" className="rounded-2xl border border-[#E5E7EB] bg-white p-6 text-center text-sm">
        <p className="text-[#DC2626]">Couldn’t load the key metrics.</p>
        <button type="button" onClick={() => refetch()} className="mt-1 font-semibold text-[#FF5615] hover:underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <section aria-label="Key metrics" aria-busy={isPending || isFetching} className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 transition-opacity ${isFetching && !isPending ? "opacity-60" : ""}`}>
      {CARDS.map(({ key, label, icon: Icon, format }) => (
        <article key={key} className="rounded-2xl border border-[#E5E7EB] bg-white p-5" aria-label={label}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#6B7280]">{label}</h2>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF1EB] text-[#FF5615]">
              <Icon className="h-4 w-4" />
            </span>
          </div>
          {isPending || !data ? (
            <div role="status" aria-label={`Loading ${label}`} className="mt-3 space-y-2">
              <div className="h-8 w-32 animate-pulse rounded bg-[#F3F4F6]" />
              <div className="h-4 w-24 animate-pulse rounded bg-[#F3F4F6]" />
            </div>
          ) : (
            <>
              <p className="mt-2 text-2xl font-extrabold text-[#111827]" data-testid={`kpi-${key}`}>
                {format(data[key].value)}
              </p>
              <div className="mt-2">
                <Change kpi={data[key]} />
              </div>
            </>
          )}
        </article>
      ))}
    </section>
  );
}
