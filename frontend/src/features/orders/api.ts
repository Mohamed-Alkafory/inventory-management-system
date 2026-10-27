import { request } from "../../lib/http";
import { mockOrdersApi } from "./mockApi";
import { normalizeDetails, toOrderPage } from "./normalize";
import type { OrderListParams, OrdersApi } from "./types";

/**
 * ► CONNECTING THE REAL API
 *   When the backend is merged, set  VITE_USE_MOCK_API=false  in your .env
 *   (the same switch the other pages use). Nothing else changes.
 */
export const USE_MOCK = import.meta.env?.VITE_USE_MOCK_API !== "false";

function listQuery(p: OrderListParams) {
  const q = new URLSearchParams({ page: String(p.page), pageSize: String(p.pageSize) });
  for (const [k, v] of Object.entries({ search: p.search, status: p.status, from: p.from, to: p.to })) if (v.trim()) q.set(k, v.trim());
  return q.toString();
}

export const realOrdersApi: OrdersApi = {
  async list(p) {
    return toOrderPage(await request<unknown>(`/orders?${listQuery(p)}`), p);
  },
  async get(id) {
    return normalizeDetails(await request<unknown>(`/orders/${id}`));
  },
  /** If your API uses other routes (e.g. PATCH /orders/:id/status), change only these two lines. */
  async confirm(id) {
    await request<unknown>(`/orders/${id}/confirm`, { method: "POST" });
  },
  async cancel(id) {
    await request<unknown>(`/orders/${id}/cancel`, { method: "POST" });
  },
};

export const ordersApi: OrdersApi = USE_MOCK ? mockOrdersApi : realOrdersApi;
