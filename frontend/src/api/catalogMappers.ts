import { ApiError } from "../lib/http";
import type { CatalogCategory, CatalogPage, CatalogQuery, ShopProduct } from "../types/shop";

/*
  Public catalog response → app types.
  Tolerant like the other mappers, but it only ever reads the customer-safe fields:
  sku, cost, exact stock, supplier and barcode are deliberately ignored.
*/

type Dict = Record<string, unknown>;

const isDict = (v: unknown): v is Dict => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);
const num = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
};
const pick = (raw: Dict, ...keys: string[]): unknown => {
  for (const key of keys) if (raw[key] !== undefined && raw[key] !== null) return raw[key];
  return undefined;
};

function badShape(what: string): never {
  throw new ApiError(0, `Unexpected ${what} response from the server.`);
}

export function toShopProduct(data: unknown): ShopProduct {
  if (!isDict(data)) return badShape("product");

  const rawId = pick(data, "id", "_id", "productId");
  const name = text(pick(data, "name", "title"));
  if ((typeof rawId !== "string" && typeof rawId !== "number") || !name) return badShape("product");

  const categoryRaw = pick(data, "category", "categoryName");
  const category = (isDict(categoryRaw) ? text(categoryRaw.name) : text(categoryRaw)) ?? "";
  const categoryId = (isDict(categoryRaw) ? text(categoryRaw.id) : undefined) ?? text(pick(data, "categoryId", "category_id"));

  const maxOrderable = Math.max(0, Math.floor(num(pick(data, "maxOrderable", "max_orderable")) ?? 0));
  const inStock = typeof data.inStock === "boolean" ? data.inStock : maxOrderable > 0;

  return {
    id: String(rawId),
    name,
    description: text(data.description),
    price: num(data.price) ?? 0,
    imageUrl: text(pick(data, "imageUrl", "image_url", "image", "thumbnail")),
    category,
    categoryId,
    inStock,
    maxOrderable,
  };
}

export function toCatalogPage(data: unknown, query: CatalogQuery): CatalogPage {
  const list = Array.isArray(data) ? data : isDict(data) ? pick(data, "data", "items", "results", "products", "content") : undefined;
  if (!Array.isArray(list)) return badShape("product list");

  const meta = isDict(data) ? (isDict(data.meta) ? data.meta : isDict(data.pagination) ? data.pagination : data) : {};
  const total = num(pick(meta, "total", "totalItems", "total_items", "totalElements", "count")) ?? list.length;
  const page = num(meta.page) ?? query.page;
  const limit = num(meta.limit) ?? query.pageSize;
  const totalPages = num(pick(meta, "totalPages", "total_pages")) ?? Math.max(1, Math.ceil(total / Math.max(1, limit)));

  return { items: list.map(toShopProduct), total, totalPages, page };
}

/** [{ id, name }, …] (optionally wrapped in { data: [...] }) → alphabetical categories. */
export function toCatalogCategories(data: unknown): CatalogCategory[] {
  const list = Array.isArray(data) ? data : isDict(data) ? pick(data, "data", "items", "results", "categories") : undefined;
  if (!Array.isArray(list)) return badShape("category list");

  const categories: CatalogCategory[] = [];
  for (const item of list) {
    if (!isDict(item)) continue;
    const rawId = pick(item, "id", "_id");
    const name = text(item.name);
    if ((typeof rawId === "string" || typeof rawId === "number") && name) categories.push({ id: String(rawId), name });
  }
  return categories.sort((a, b) => a.name.localeCompare(b.name));
}

/** App query → query-string params for GET /catalog/products. Empty filters are left out. */
export function toCatalogParams(query: CatalogQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {
    page: query.page,
    limit: query.pageSize,
    sort: query.sort,
    order: query.order,
  };
  if (query.search) params.search = query.search;
  if (query.category) params.categoryId = query.category;
  return params;
}
