import type { DateRange } from "../../lib/dateRange";

export type { DateRange };

export type ReportKind = "inventory" | "low-stock" | "sales" | "stock-movements";

export interface ReportDefinition {
  kind: ReportKind;
  title: string;
  description: string;
  /** Path of the CSV endpoint (without query parameters). */
  path: string;
  /** Sales and stock movements accept from/to; inventory and low stock do not. */
  usesRange: boolean;
}

export interface DownloadedFile {
  blob: Blob;
  filename: string;
}

/** Same shape for the mock and the real API, so switching is one line. */
export interface ReportsApi {
  download(kind: ReportKind, range: DateRange): Promise<DownloadedFile>;
}
