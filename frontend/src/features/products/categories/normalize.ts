import type { Category, CategoryListParams, CategoryPage } from "./types";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export function normalizeCategory(raw: unknown): Category {
  const r = isObject(raw) ? raw : {};
  const counts = isObject(r._count) ? r._count : {};
  return {
    id: (r.id as Category["id"]) ?? "",
    name: typeof r.name === "string" ? r.name : "",
    productCount: num(r.productCount) ?? num(r.product_count) ?? num(r.productsCount) ?? num(counts.products) ?? 0,
  };
}

/**
 * Accepts either
 *   - a plain array (no server pagination → we filter + slice here), or
 *   - { items | data: [...], total | meta.total | pagination.total | count }  (server-paginated)
 */
export function toPage(body: unknown, params: CategoryListParams): CategoryPage {
  if (Array.isArray(body)) {
    const q = params.search.trim().toLowerCase();
    const all = body.map(normalizeCategory).filter((c) => !q || c.name.toLowerCase().includes(q));
    const start = (params.page - 1) * params.pageSize;
    return { items: all.slice(start, start + params.pageSize), total: all.length };
  }

  const b = isObject(body) ? body : {};
  const rawItems = Array.isArray(b.items) ? b.items : Array.isArray(b.data) ? b.data : [];
  const meta = isObject(b.meta) ? b.meta : {};
  const pagination = isObject(b.pagination) ? b.pagination : {};
  const items = rawItems.map(normalizeCategory);
  const total = num(b.total) ?? num(meta.total) ?? num(pagination.total) ?? num(b.count) ?? items.length;
  return { items, total };
}
