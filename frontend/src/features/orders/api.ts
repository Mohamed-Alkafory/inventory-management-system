import { request } from "../../lib/http";
import { USE_MOCK } from "../../lib/env";
import { mockOrdersApi } from "./mockApi";
import { normalizeDetails, toOrderPage } from "./normalize";
import type { OrderListParams, OrdersApi } from "./types";

/**
 * One switch for the whole app: the shared `VITE_USE_MOCK` flag (lib/env).
 * The standalone `VITE_USE_MOCK_API` flag previously made the orders pages
 * serve demo data while checkout hit the real backend — so real orders
 * never appeared here. Re-exported so other imports keep working.
 */
export { USE_MOCK };

function listQuery(p: OrderListParams) {
  // The backend contract (§1/§3.7) takes `limit` (not `pageSize`), an
  // UPPERCASE status enum, and date-times for the from/to range. Unknown
  // query params are rejected outright (forbidNonWhitelisted), so sending
  // anything else breaks the whole request.
  const q = new URLSearchParams({ page: String(p.page), limit: String(p.pageSize) });
  if (p.search.trim()) q.set("search", p.search.trim());
  if (p.status) q.set("status", p.status.toUpperCase());
  if (p.createdById) q.set("createdById", p.createdById);
  // Local calendar days → full-day date-time bounds so a "from"/"to" filter
  // includes everything created that day.
  if (p.from.trim()) q.set("from", `${p.from}T00:00:00`);
  if (p.to.trim()) q.set("to", `${p.to}T23:59:59`);
  return q.toString();
}

export const realOrdersApi: OrdersApi = {
  async list(p) {
    return toOrderPage(await request<unknown>(`/orders?${listQuery(p)}`), p);
  },
  async get(id) {
    return normalizeDetails(await request<unknown>(`/orders/${id}`));
  },
  /** The real API exposes one transition endpoint: PATCH /orders/:id/status. */
  async confirm(id) {
    await request<unknown>(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ newStatus: "CONFIRMED" }) });
  },
  async cancel(id) {
    await request<unknown>(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ newStatus: "CANCELLED" }) });
  },
};

export const ordersApi: OrdersApi = USE_MOCK ? mockOrdersApi : realOrdersApi;
