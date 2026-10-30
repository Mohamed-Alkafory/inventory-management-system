import { AlertTriangle, Boxes, Package, PackageCheck, PackageX, ShoppingCart, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, ErrorState, Skeleton } from "../../components/ui";
import { errorMessage } from "../../lib/errorMessage";
import { formatInt, formatMoney } from "./format";
import { useDashboardSummary } from "./hooks";
import type { DashboardSummary, DateRange } from "./types";

type Key = Exclude<keyof DashboardSummary, "period">;

const CARDS: Array<{
  key: Key;
  label: string;
  icon: LucideIcon;
  format: (n: number) => string;
  tone: string;
}> = [
  { key: "revenueInPeriod", label: "Revenue in period", icon: Wallet, format: formatMoney, tone: "bg-success-50 text-success-700" },
  { key: "ordersInPeriod", label: "Orders in period", icon: ShoppingCart, format: formatInt, tone: "bg-info-50 text-info-700" },
  { key: "totalProducts", label: "Total products", icon: Package, format: formatInt, tone: "bg-primary-50 text-primary-700" },
  { key: "totalStockUnits", label: "Stock units", icon: Boxes, format: formatInt, tone: "bg-slate-100 text-slate-700" },
  { key: "stockValue", label: "Stock value", icon: PackageCheck, format: formatMoney, tone: "bg-warning-50 text-warning-700" },
  { key: "lowStockCount", label: "Low stock", icon: AlertTriangle, format: formatInt, tone: "bg-warning-50 text-warning-700" },
  { key: "outOfStockCount", label: "Out of stock", icon: PackageX, format: formatInt, tone: "bg-danger-50 text-danger-700" },
];

export default function SummaryCards({ range }: { range: DateRange }) {
  const query = useDashboardSummary(range);

  if (query.isError) {
    return (
      <Card>
        <ErrorState
          title="Couldn't load the dashboard summary"
          message={errorMessage(query.error, "Check that the backend is running, then try again.")}
          onRetry={() => void query.refetch()}
        />
      </Card>
    );
  }

  return (
    <section
      aria-label="Dashboard summary"
      aria-busy={query.isPending || query.isFetching}
      className={`grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-4 ${query.isFetching && !query.isPending ? "opacity-60" : ""}`}
    >
      {CARDS.map(({ key, label, icon: Icon, format, tone }) => (
        <Card key={key} className="p-5" aria-label={label}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-muted">{label}</h2>
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-control ${tone}`}>
              <Icon className="size-5" aria-hidden="true" />
            </span>
          </div>
          {query.isPending || !query.data ? (
            <Skeleton className="mt-3 h-8 w-28" />
          ) : (
            <p className="mt-3 truncate text-2xl font-extrabold tabular-nums text-ink" title={format(query.data[key])}>
              {format(query.data[key])}
            </p>
          )}
        </Card>
      ))}
    </section>
  );
}
