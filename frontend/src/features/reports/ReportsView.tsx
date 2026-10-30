import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download } from "lucide-react";
import DateRangePicker from "../../components/date-range/DateRangePicker";
import { Button, Card, CardBody, CardHeader } from "../../components/ui";
import { DEFAULT_RANGE, formatRange, parseRange } from "../../lib/dateRange";
import type { DateRange } from "../../lib/dateRange";
import { errorMessage } from "../../lib/errorMessage";
import { REPORT_LIST, reportsApi, saveDownloadedFile } from "./api";
import type { ReportDefinition } from "./types";

function DownloadButton({ definition, range }: { definition: ReportDefinition; range: DateRange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      saveDownloadedFile(await reportsApi.download(definition.kind, range));
    } catch (err) {
      setError(errorMessage(err, "Couldn't download this report. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4">
      <Button variant="secondary" size="sm" loading={busy} leftIcon={<Download className="size-4" aria-hidden="true" />} onClick={run}>
        {busy ? "Preparing..." : "Download CSV"}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
}

export default function ReportsView() {
  // The range lives in the URL (?from=...&to=...): shareable and survives a refresh.
  const [params, setParams] = useSearchParams();
  const from = params.get("from");
  const to = params.get("to");
  const range = useMemo<DateRange>(() => parseRange(from, to) ?? DEFAULT_RANGE(), [from, to]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink">Reports</h1>
          <p className="mt-1 text-sm text-muted">
            Download CSV exports of the inventory and sales data. Sales and stock movements use the selected range.
          </p>
        </div>
        <DateRangePicker
          value={range}
          onChange={(r) => setParams({ from: r.from, to: r.to }, { replace: true })}
        />
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {REPORT_LIST.map((definition) => (
          <Card key={definition.kind}>
            <CardHeader title={definition.title} description={definition.description} />
            <CardBody>
              <p className="text-xs font-semibold text-muted">
                {definition.usesRange ? `Range: ${formatRange(range)}` : "Current catalogue - no date range."}
              </p>
              <DownloadButton definition={definition} range={range} />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
