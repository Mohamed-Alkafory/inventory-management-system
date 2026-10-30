import { useState } from "react";
import { Download } from "lucide-react";
import { EXPORT_ENABLED, reportsApi } from "./api";
import type { DateRange } from "./types";

/** Saves a Blob as a file download. */
function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ExportButton({ range, enabled = EXPORT_ENABLED }: { range: DateRange; enabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const { blob, filename } = await reportsApi.exportCsv(range);
      save(blob, filename);
    } catch {
      setError("Couldn’t export the report. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={run}
        disabled={!enabled || busy}
        aria-describedby={enabled ? undefined : "export-note"}
        title={enabled ? undefined : "Available when the backend export endpoint is ready"}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-[#111827] hover:bg-[#F9FAFB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615] disabled:cursor-not-allowed disabled:text-[#9CA3AF] disabled:hover:bg-white"
      >
        <Download className="h-4 w-4" />
        {busy ? "Exporting…" : "Export CSV"}
      </button>
      {!enabled && (
        <span id="export-note" className="sr-only">
          Export is disabled until the backend export endpoint is available.
        </span>
      )}
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-[#DC2626]">
          {error}
        </p>
      )}
    </div>
  );
}
