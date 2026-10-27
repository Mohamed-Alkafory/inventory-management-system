import type { StockStatus } from "../components/ui/StatusBadge";
import type { InventoryProduct, ProductCategory, ProductPage, ProductQuery } from "../types/inventory";
import { ApiError } from "./errors";

/*
  Backend response → app types for products.
  Tolerant on purpose (camelCase / snake_case, wrapped or bare lists), like authMappers.
  Tighten it once the real endpoints are final.
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
  throw new ApiError(`Unexpected ${what} response from the server.`);
}

/** Stock status from the numbers: 0 → out of stock, at/below the reorder level → low stock. */
export function deriveStockStatus(stock: number, reorderLevel: number): StockStatus {
  if (stock <= 0) return "out_of_stock";
  if (stock <= reorderLevel) return "low_stock";
  return "in_stock";
}

/** "IN_STOCK", "in-stock", "In Stock" … → "in_stock". */
export function toStockStatus(value: unknown): StockStatus | undefined {
  const normalised = text(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (normalised === "in_stock" || normalised === "low_stock" || normalised === "out_of_stock") return normalised;
  return undefined;
}

export function toProduct(data: unknown): InventoryProduct {
  if (!isDict(data)) return badShape("product");

  const rawId = pick(data, "id", "_id", "productId");
  const name = text(pick(data, "name", "title"));
  if ((typeof rawId !== "string" && typeof rawId !== "number") || !name) return badShape("product");

  // The backend sends `categoryId` only; the name is joined in from the category list (useProducts).
  const categoryRaw = pick(data, "category", "categoryName");
  const category = (isDict(categoryRaw) ? text(categoryRaw.name) : text(categoryRaw)) ?? "";
  const categoryId = text(pick(data, "categoryId", "category_id")) ?? (isDict(categoryRaw) ? text(categoryRaw.id) : undefined) ?? "";

  const stock = num(pick(data, "stock", "quantity", "stockQuantity", "stock_quantity")) ?? 0;
  const reorderLevel = num(pick(data, "reorderLevel", "reorder_level", "reorderPoint", "minStock")) ?? 0;

  return {
    id: String(rawId),
    name,
    sku: text(data.sku) ?? "—",
    categoryId,
    supplierId: text(pick(data, "supplierId", "supplier_id")),
    barcode: text(data.barcode),
    isActive: typeof data.isActive === "boolean" ? data.isActive : true,
    category,
    description: text(data.description),
    price: num(data.price) ?? 0,
    costPrice: num(pick(data, "costPrice", "cost_price", "cost")),
    stock,
    reorderLevel,
    status: toStockStatus(data.status) ?? deriveStockStatus(stock, reorderLevel),
    imageUrl: text(pick(data, "imageUrl", "image_url", "image", "thumbnail")),
  };
}

export function toProductPage(data: unknown): ProductPage {
  const list = Array.isArray(data) ? data : isDict(data) ? pick(data, "items", "data", "results", "products", "content") : undefined;
  if (!Array.isArray(list)) return badShape("product list");

  const meta = isDict(data) ? (isDict(data.meta) ? data.meta : isDict(data.pagination) ? data.pagination : data) : {};
  const total = num(pick(meta, "total", "totalItems", "total_items", "totalElements", "count")) ?? list.length;

  return { items: list.map(toProduct), total };
}

/** [{ id, name }, …] (optionally wrapped in { data: [...] }) → categories sorted by name. */
export function toCategories(data: unknown): ProductCategory[] {
  const list = Array.isArray(data) ? data : isDict(data) ? pick(data, "data", "items", "results", "categories") : undefined;
  if (!Array.isArray(list)) return badShape("category list");

  const categories: ProductCategory[] = [];
  for (const item of list) {
    if (!isDict(item)) continue;
    const rawId = pick(item, "id", "_id");
    const name = text(item.name);
    if ((typeof rawId === "string" || typeof rawId === "number") && name) categories.push({ id: String(rawId), name });
  }
  return categories.sort((a, b) => a.name.localeCompare(b.name));
}

/** Our sort column → the backend's field name. */
const SORT_FIELD: Record<NonNullable<ProductQuery["sortBy"]>, string> = {
  name: "name",
  sku: "sku",
  price: "price",
  stock: "quantity",
};

/** Max page size accepted by the backend list endpoints (`limit` ≤ 100). */
export const MAX_CATEGORY_LIMIT = 100;

/** App query → query-string params for GET /products. Empty filters are left out. */
export function toListParams(query: ProductQuery): Record<string, string | number> {
  const params: Record<string, string | number> = { page: query.page, limit: query.pageSize };
  if (query.search) params.search = query.search;
  if (query.category) params.categoryId = query.category;
  if (query.status) params.stockStatus = query.status;
  if (query.sortBy) {
    params.sortBy = SORT_FIELD[query.sortBy];
    params.sortOrder = query.sortDir;
  }
  return params;
}
