import { withMock } from "../../api/mockSwitch";
import { rangeQueryString, todayISO } from "../../lib/dateRange";
import { requestBlob } from "../../lib/http";
import { mockReportsApi } from "./mockApi";
import type { DateRange, DownloadedFile, ReportDefinition, ReportKind, ReportsApi } from "./types";

export const REPORTS: Record<ReportKind, ReportDefinition> = {
  inventory: {
    kind: "inventory",
    title: "Inventory",
    description: "Every active product with stock, price and cost price.",
    path: "/reports/inventory.csv",
    usesRange: false,
  },
  "low-stock": {
    kind: "low-stock",
    title: "Low stock",
    description: "Products at or below their reorder level, with the shortfall.",
    path: "/reports/low-stock.csv",
    usesRange: false,
  },
  sales: {
    kind: "sales",
    title: "Sales",
    description: "One row per non-cancelled order in the selected range.",
    path: "/reports/sales.csv",
    usesRange: true,
  },
  "stock-movements": {
    kind: "stock-movements",
    title: "Stock movements",
    description: "Every stock increase and decrease in the selected range.",
    path: "/reports/stock-movements.csv",
    usesRange: true,
  },
};

export const REPORT_LIST = Object.values(REPORTS);

/** `Content-Disposition: attachment; filename="..."` -> the filename. */
export function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;

  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (encoded) {
    const value = encoded[1].trim().replace(/^"|"$/g, "");
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() ?? null;
}

/** A readable name when the server omits Content-Disposition. */
export function fallbackFilename(kind: ReportKind, range: DateRange): string {
  if (kind === "inventory") return `inventory-${todayISO()}.csv`;
  if (kind === "low-stock") return `low-stock-${todayISO()}.csv`;
  return `${kind}-${range.from}_${range.to}.csv`;
}

const realReportsApi: ReportsApi = {
  async download(kind, range) {
    const definition = REPORTS[kind];
    const query = definition.usesRange ? `?${rangeQueryString(range)}` : "";
    const res = await requestBlob(`${definition.path}${query}`);
    const filename =
      filenameFromContentDisposition(res.headers.get("Content-Disposition")) ?? fallbackFilename(kind, range);
    return { blob: await res.blob(), filename };
  },
};

/** The authenticated request itself (exported so tests can exercise it directly). */
export const downloadReport: ReportsApi["download"] = (kind, range) => realReportsApi.download(kind, range);

export const reportsApi: ReportsApi = withMock(realReportsApi, mockReportsApi);

/** Saves a Blob as a file download. */
export function saveDownloadedFile({ blob, filename }: DownloadedFile): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
