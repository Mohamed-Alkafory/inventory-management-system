import type { InventoryItem, InventoryListParams, MovementListParams, Paged, StockMovement } from "./types";

/** Local calendar day "YYYY-MM-DD" of an ISO date-time (matches <input type="date">). */
export function localDay(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function paginate<T>(all: T[], page: number, pageSize: number): Paged<T> {
  const start = (page - 1) * pageSize;
  return { items: all.slice(start, start + pageSize), total: all.length };
}

export function filterItems(items: InventoryItem[], p: InventoryListParams): InventoryItem[] {
  const q = p.search.trim().toLowerCase();
  return items.filter(
    (i) =>
      (!q || i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)) &&
      (!p.categoryId || String(i.categoryId) === p.categoryId) &&
      (!p.status || i.status === p.status),
  );
}

export function filterMovements(list: StockMovement[], p: MovementListParams): StockMovement[] {
  const q = p.search.trim().toLowerCase();
  return list
    .filter(
      (m) =>
        (p.productId === undefined || String(m.productId) === String(p.productId)) &&
        (!q || m.productName.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q) || m.reason.toLowerCase().includes(q)) &&
        (p.type === "" || (p.type === "increase" ? m.change > 0 : m.change < 0)) &&
        (!p.from || localDay(m.createdAt) >= p.from) &&
        (!p.to || localDay(m.createdAt) <= p.to),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
