import { request } from "../../../lib/http";
import { USE_MOCK } from "../../../lib/env";
import { mockSuppliersApi } from "./mockApi";
import { toPage } from "./normalize";
import type { SupplierListParams, SuppliersApi } from "./types";

/**
 * One switch for the whole app: the shared `VITE_USE_MOCK` flag (lib/env).
 * Re-exported so existing `USE_MOCK` imports keep working.
 */
export { USE_MOCK };

function buildQuery(p: SupplierListParams) {
  // The API contract uses `limit`, not the UI's `pageSize`.
  const q = new URLSearchParams({ page: String(p.page), limit: String(p.pageSize) });
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
    await request<unknown>(`/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(values) });
  },
  /** DELETE is a soft delete on the backend (sets `isActive: false`). */
  async deactivate(id) {
    await request<unknown>(`/suppliers/${id}`, { method: "DELETE" });
  },
};

export const suppliersApi: SuppliersApi = USE_MOCK ? mockSuppliersApi : realSuppliersApi;
