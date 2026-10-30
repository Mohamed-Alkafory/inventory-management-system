import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import CategoryDonut from "./CategoryDonut";
import { DEFAULT_RANGE, parseRange } from "./dates";
import DateRangePicker from "./DateRangePicker";
import ExportButton from "./ExportButton";
import { USE_MOCK } from "./api";
import KpiCards from "./KpiCards";
import SalesOverviewChart from "./SalesOverviewChart";
import TopProducts from "./TopProducts";
import type { DateRange } from "./types";

export default function ReportsView() {
  // The range lives in the URL (?from=…&to=…): shareable, survives a refresh, works with the back button.
  const [params, setParams] = useSearchParams();
  const from = params.get("from");
  const to = params.get("to");
  const range = useMemo<DateRange>(() => parseRange(from, to) ?? DEFAULT_RANGE(), [from, to]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#111827]">Reports</h1>
          <p className="mt-1 text-sm text-[#6B7280]">View insights and analytics about your business</p>
          {USE_MOCK && (
            <p className="mt-2 inline-block rounded-full bg-[#FFF1EB] px-2.5 py-1 text-[11px] font-semibold text-[#FF5615]">Demo data (mock API)</p>
          )}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <DateRangePicker value={range} onChange={(r) => setParams({ from: r.from, to: r.to }, { replace: true })} />
          <ExportButton range={range} />
        </div>
      </div>

      <div className="mt-6 space-y-5">
        <KpiCards range={range} />
        <div className="grid gap-5 lg:grid-cols-5">
          <SalesOverviewChart range={range} className="lg:col-span-3" />
          <CategoryDonut range={range} className="lg:col-span-2" />
        </div>
        <TopProducts range={range} />
      </div>
    </div>
  );
}
