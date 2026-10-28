import { localDay } from "./format";
import type { OrderListParams, OrderSummary, Paged } from "./types";

export function paginate<T>(all: T[], page: number, pageSize: number): Paged<T> {
  const start = (page - 1) * pageSize;
  return { items: all.slice(start, start + pageSize), total: all.length };
}

/** Shared by the mock and by the "server sent a plain array" fallback. Newest first. */
export function filterOrders<T extends OrderSummary>(orders: T[], p: OrderListParams): T[] {
  const q = p.search.trim().toLowerCase().replace(/^#/, "");
  return orders
    .filter(
      (o) =>
        (!q || o.number.toLowerCase().replace(/^#/, "").includes(q) || o.customerName.toLowerCase().includes(q)) &&
        (!p.status || o.status === p.status) &&
        (!p.from || localDay(o.createdAt) >= p.from) &&
        (!p.to || localDay(o.createdAt) <= p.to) &&
        (!p.createdById || o.createdById === p.createdById),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
