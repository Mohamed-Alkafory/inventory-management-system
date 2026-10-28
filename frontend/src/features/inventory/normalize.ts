import { filterItems, filterMovements, paginate } from "./filters";
import { STATUSES, statusFor } from "./status";
import type {
  InventoryItem,
  InventoryListParams,
  MovementListParams,
  Paged,
  StockMovement,
  StockStatus,
} from "./types";

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null;
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const idOf = (v: unknown) => (typeof v === "string" || typeof v === "number" ? v : undefined);

function readStatus(v: unknown): StockStatus | undefined {
  const s = str(v)?.toLowerCase().replace(/[\s-]+/g, "_");
  return STATUSES.find((x) => x === s);
}

export function normalizeItem(raw: unknown): InventoryItem {
  const r: Obj = isObject(raw) ? raw : {};
  const product: Obj = isObject(r.product) ? r.product : {};
  const cat: Obj = isObject(r.category) ? r.category : {};
  const currentStock = num(r.currentStock) ?? num(r.current_stock) ?? num(r.stock) ?? num(r.quantity) ?? 0;
  const reorderPoint = num(r.reorderPoint) ?? num(r.reorder_point) ?? num(r.minStock) ?? num(r.min_stock) ?? 0;
  return {
    id: idOf(r.productId) ?? idOf(r.product_id) ?? idOf(product.id) ?? idOf(r.id) ?? "",
    name: str(r.name) ?? str(r.productName) ?? str(product.name) ?? "",
    sku: str(r.sku) ?? str(product.sku) ?? "",
    imageUrl: str(r.imageUrl) ?? str(r.image_url) ?? str(product.imageUrl) ?? null,
    categoryId: idOf(cat.id) ?? idOf(r.categoryId) ?? idOf(r.category_id) ?? null,
    categoryName: str(cat.name) ?? str(r.categoryName) ?? str(r.category_name) ?? str(r.category) ?? "",
    currentStock,
    reorderPoint,
    status: readStatus(r.status) ?? statusFor(currentStock, reorderPoint),
  };
}

export function normalizeMovement(raw: unknown): StockMovement {
  const r: Obj = isObject(raw) ? raw : {};
  const product: Obj = isObject(r.product) ? r.product : {};
  const user: Obj = isObject(r.user) ? r.user : {};
  const by = isObject(r.createdBy) ? str((r.createdBy as Obj).name) : str(r.createdBy);
  return {
    id: idOf(r.id) ?? "",
    productId: idOf(r.productId) ?? idOf(r.product_id) ?? idOf(product.id) ?? "",
    productName: str(r.productName) ?? str(r.product_name) ?? str(product.name) ?? "",
    sku: str(r.sku) ?? str(product.sku) ?? "",
    change: num(r.change) ?? num(r.delta) ?? num(r.quantityChange) ?? num(r.quantity_change) ?? num(r.quantity) ?? 0,
    stockAfter: num(r.stockAfter) ?? num(r.stock_after) ?? num(r.quantityAfter) ?? num(r.quantity_after) ?? num(r.balance) ?? num(r.balanceAfter) ?? null,
    reason: str(r.reason) ?? str(r.note) ?? "",
    createdAt: str(r.createdAt) ?? str(r.created_at) ?? str(r.date) ?? "",
    createdBy: by ?? str(r.created_by) ?? str(user.name) ?? "",
  };
}

/** `[...]` or `{ items | data: [...], total | meta.total | pagination.total | count }`. */
function unpack(body: unknown): { list: unknown[]; total?: number; isArray: boolean } {
  if (Array.isArray(body)) return { list: body, isArray: true };
  const b: Obj = isObject(body) ? body : {};
  const meta: Obj = isObject(b.meta) ? b.meta : {};
  const pagination: Obj = isObject(b.pagination) ? b.pagination : {};
  const list = Array.isArray(b.items) ? b.items : Array.isArray(b.data) ? b.data : [];
  return { list, total: num(b.total) ?? num(meta.total) ?? num(pagination.total) ?? num(b.count), isArray: false };
}

export function toItemPage(body: unknown, p: InventoryListParams): Paged<InventoryItem> {
  const { list, total, isArray } = unpack(body);
  const items = list.map(normalizeItem);
  if (isArray) return paginate(filterItems(items, p), p.page, p.pageSize); // no server paging → do it here
  return { items, total: total ?? items.length };
}

export function toMovementPage(body: unknown, p: MovementListParams): Paged<StockMovement> {
  const { list, total, isArray } = unpack(body);
  const items = list.map(normalizeMovement);
  if (isArray) return paginate(filterMovements(items, p), p.page, p.pageSize);
  return { items, total: total ?? items.length };
}
