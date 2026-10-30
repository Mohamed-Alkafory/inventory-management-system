import { ApiError, request } from "../../lib/http";
import { mockReportsApi } from "./mockApi";
import { normalizeCategories, normalizeOverview, normalizeSummary, normalizeTopProducts } from "./normalize";
import type { DateRange, ReportsApi } from "./types";

/**
 * ► CONNECTING THE REAL API
 *   When the dashboard endpoints are merged, set  VITE_USE_MOCK_API=false  in your .env
 *   (the same switch the other pages use). Nothing else changes.
 *
 * ► CSV EXPORT
 *   The button stays disabled until the backend endpoint exists. Then set
 *   VITE_REPORTS_EXPORT_ENABLED=true  and it switches on.
 */
export const USE_MOCK = import.meta.env?.VITE_USE_MOCK_API !== "false";
export const EXPORT_ENABLED = import.meta.env?.VITE_REPORTS_EXPORT_ENABLED === "true";

const API_URL = import.meta.env?.VITE_API_URL ?? "";
const PATH = "/reports"; // change here if the endpoints live elsewhere, e.g. "/dashboard"

const qs = (r: DateRange) => `from=${r.from}&to=${r.to}`;

export const realReportsApi: ReportsApi = {
  async summary(r) {
    return normalizeSummary(await request<unknown>(`${PATH}/summary?${qs(r)}`));
  },
  async overview(r) {
    return normalizeOverview(await request<unknown>(`${PATH}/sales-overview?${qs(r)}`));
  },
  async categories(r) {
    return normalizeCategories(await request<unknown>(`${PATH}/sales-by-category?${qs(r)}`));
  },
  async topProducts(r, limit) {
    return normalizeTopProducts(await request<unknown>(`${PATH}/top-products?${qs(r)}&limit=${limit}`));
  },
  /** GET → a CSV file. (`request()` only handles JSON, so this one reads the raw response.) */
  async exportCsv(r) {
    let res: Response;
    try {
      res = await fetch(`${API_URL}${PATH}/export?${qs(r)}&format=csv`, { credentials: "include" });
    } catch {
      throw new ApiError(0, "Can’t reach the server. Check your connection and try again.");
    }
    if (!res.ok) throw new ApiError(res.status, `Export failed (${res.status})`);
    const named = /filename="?([^";]+)"?/i.exec(res.headers.get("Content-Disposition") ?? "")?.[1];
    return { blob: await res.blob(), filename: named ?? `sales-report_${r.from}_${r.to}.csv` };
  },
};

export const reportsApi: ReportsApi = USE_MOCK ? mockReportsApi : realReportsApi;
