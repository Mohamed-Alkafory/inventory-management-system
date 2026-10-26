import { request } from "../../../lib/http";
import { mockSuppliersApi } from "./mockApi";
import { toPage } from "./normalize";
import type { SupplierListParams, SuppliersApi } from "./types";

/**
 * ► CONNECTING THE REAL API
 *   When the backend is merged, set  VITE_USE_MOCK_API=false  in your .env
 *   (the same switch the categories page uses). Nothing else changes.
 */
export const USE_MOCK = import.meta.env?.VITE_USE_MOCK_API !== "false";

function buildQuery(p: SupplierListParams) {
  const q = new URLSearchParams({ page: String(p.page), pageSize: String(p.pageSize) });
  if (p.search.trim()) q.set("search", p.search.trim());
  return q.toString();
}

export const realSuppliersApi: SuppliersApi = {
  async list(p) {
    return toPage(await request<unknown>(`/suppliers?${buildQuery(p)}`), p);
  },
  async create(values) {
    await request<unknown>("/suppliers", { method: "POST", body: JSON.stringify(values) });
  },
  async update(id, values) {
    await request<unknown>(`/suppliers/${id}`, { method: "PUT", body: JSON.stringify(values) });
  },
  /** Deactivate = PATCH isActive:false. If your API uses another route/verb, change only this line. */
  async deactivate(id) {
    await request<unknown>(`/suppliers/${id}`, { method: "PATCH", body: JSON.stringify({ isActive: false }) });
  },
};

export const suppliersApi: SuppliersApi = USE_MOCK ? mockSuppliersApi : realSuppliersApi;
