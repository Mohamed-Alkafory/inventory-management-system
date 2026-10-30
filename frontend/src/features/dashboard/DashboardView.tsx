import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download } from "lucide-react";
import DateRangePicker from "../../components/date-range/DateRangePicker";
import { buttonClass } from "../../components/ui";
import { DEFAULT_RANGE, parseRange } from "../../lib/dateRange";
import type { DateRange } from "../../lib/dateRange";
import { ApiError } from "../../lib/http";
import LowStockTable from "./LowStockTable";
import SalesChart from "./SalesChart";
import StockMovementsChart from "./StockMovementsChart";
import SummaryCards from "./SummaryCards";
import TopProducts from "./TopProducts";
import { useDashboardSummary } from "./hooks";

export default function DashboardView() {
  // The range lives in the URL (?from=...&to=...): shareable, survives a refresh and works with the back button.
  const [params, setParams] = useSearchParams();
  const from = params.get("from");
  const to = params.get("to");
  const range = useMemo<DateRange>(() => parseRange(from, to) ?? DEFAULT_RANGE(), [from, to]);

  // The summary query is also rendered by SummaryCards; React Query shares the one request.
  const summary = useDashboardSummary(range);
  const rangeError =
    summary.isError && summary.error instanceof ApiError && summary.error.serverMessage
      ? summary.error.serverMessage
      : null;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Sales, stock and low-stock products from the last selected period.</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <DateRangePicker
            value={range}
            onChange={(r) => setParams({ from: r.from, to: r.to }, { replace: true })}
            serverError={rangeError}
          />
          <Link to="/admin/reports" className={buttonClass("secondary", "md")}>
            <Download className="size-4" aria-hidden="true" /> Reports
          </Link>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        <SummaryCards range={range} />

        <div className="grid gap-5 lg:grid-cols-2">
          <SalesChart range={range} />
          <StockMovementsChart range={range} />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <TopProducts range={range} />
          <LowStockTable />
        </div>
      </div>
    </div>
  );
}
