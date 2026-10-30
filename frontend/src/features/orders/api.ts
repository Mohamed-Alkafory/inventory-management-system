import { request } from "../../lib/http";
import { USE_MOCK } from "../../lib/env";
import { mockCustomerOrdersApi, mockStaffOrdersApi } from "./mockApi";
import {
  normalizeCustomerOrder,
  normalizeOrderNote,
  normalizeStaffOrder,
  toCustomerOrderPage,
  toStaffOrderPage,
} from "./normalize";
import type {
  CreateMyOrderInput,
  CustomerOrdersApi,
  Id,
  MyOrderListParams,
  OrderListParams,
  StaffOrdersApi,
} from "./types";

/**
 * One switch for the whole app: the shared `VITE_USE_MOCK` flag (lib/env).
 * Re-exported so the existing "Demo data (mock API)" badges keep working.
 */
export { USE_MOCK };

function myListQuery(p: MyOrderListParams) {
  const q = new URLSearchParams({ page: String(p.page), limit: String(p.pageSize) });
  if (p.status) q.set("status", p.status);
  return q.toString();
}

function staffListQuery(p: OrderListParams) {
  // The backend takes `limit` (not `pageSize`), an UPPERCASE status enum, and
  // date-times for the from/to range. Unknown query params are rejected
  // outright (forbidNonWhitelisted), so nothing else is sent.
  const q = new URLSearchParams({ page: String(p.page), limit: String(p.pageSize) });
  if (p.search.trim()) q.set("search", p.search.trim());
  if (p.status) q.set("status", p.status);
  // Local calendar days → full-day date-time bounds.
  if (p.from.trim()) q.set("from", `${p.from}T00:00:00`);
  if (p.to.trim()) q.set("to", `${p.to}T23:59:59`);
  return q.toString();
}

const encode = (id: Id) => encodeURIComponent(String(id));

/** Customer scope: /orders/mine* — ownership is enforced server-side. */
export const realCustomerOrdersApi: CustomerOrdersApi = {
  async listMyOrders(p) {
    return toCustomerOrderPage(await request<unknown>(`/orders/mine?${myListQuery(p)}`), p);
  },
  async getMyOrder(id) {
    return normalizeCustomerOrder(await request<unknown>(`/orders/mine/${encode(id)}`));
  },
  async cancelMyOrder(id) {
    await request<unknown>(`/orders/mine/${encode(id)}/cancel`, { method: "POST" });
  },
  async createMyOrder(input: CreateMyOrderInput) {
    return normalizeCustomerOrder(
      await request<unknown>("/orders/mine", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  },
};

/** Staff/support/admin scope: /orders*. */
export const realStaffOrdersApi: StaffOrdersApi = {
  async listOrders(p) {
    return toStaffOrderPage(await request<unknown>(`/orders?${staffListQuery(p)}`), p);
  },
  async getOrder(id) {
    return normalizeStaffOrder(await request<unknown>(`/orders/${encode(id)}`));
  },
  async updateOrderStatus(id: Id, status: "CONFIRMED" | "CANCELLED") {
    await request<unknown>(`/orders/${encode(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ newStatus: status }),
    });
  },
  async cancelOrder(id) {
    await request<unknown>(`/orders/${encode(id)}/cancel`, { method: "POST" });
  },
  async listNotes(id) {
    const body = await request<unknown>(`/orders/${encode(id)}/notes`);
    return (Array.isArray(body) ? body : []).map(normalizeOrderNote);
  },
  async addNote(id, note) {
    return normalizeOrderNote(
      await request<unknown>(`/orders/${encode(id)}/notes`, {
        method: "POST",
        body: JSON.stringify({ note }),
      }),
    );
  },
};

export const customerOrdersApi: CustomerOrdersApi = USE_MOCK ? mockCustomerOrdersApi : realCustomerOrdersApi;
export const staffOrdersApi: StaffOrdersApi = USE_MOCK ? mockStaffOrdersApi : realStaffOrdersApi;
