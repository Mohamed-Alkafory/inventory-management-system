import { localDay } from "./format";
import type { MyOrderListParams, OrderListParams, OrderStatus, Paged } from "./types";

export function paginate<T>(all: T[], page: number, pageSize: number): Paged<T> {
  const start = (page - 1) * pageSize;
  return { items: all.slice(start, start + pageSize), total: all.length };
}

/** Fields the client-side fallbacks (plain-array responses / mock) can filter on. */
interface FilterableOrder {
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  customerName?: string;
  recipientName?: string;
}

const matchesSearch = (o: FilterableOrder, q: string) =>
  !q ||
  o.orderNumber.toLowerCase().replace(/^#/, "").includes(q) ||
  (o.customerName ?? "").toLowerCase().includes(q) ||
  (o.recipientName ?? "").toLowerCase().includes(q);

/** Shared by the staff mock and by the "server sent a plain array" fallback. Newest first. */
export function filterOrders<T extends FilterableOrder>(orders: T[], p: OrderListParams): T[] {
  const q = p.search.trim().toLowerCase().replace(/^#/, "");
  return orders
    .filter(
      (o) =>
        matchesSearch(o, q) &&
        (!p.status || o.status === p.status) &&
        (!p.from || localDay(o.createdAt) >= p.from) &&
        (!p.to || localDay(o.createdAt) <= p.to),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Customer scope only supports a status filter. Newest first. */
export function filterMyOrders<T extends FilterableOrder>(orders: T[], p: MyOrderListParams): T[] {
  return orders
    .filter((o) => !p.status || o.status === p.status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
