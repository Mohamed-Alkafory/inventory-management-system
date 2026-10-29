import type { StockFailure } from "./types";

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null;
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const num = (v: unknown) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
};
const idOf = (v: unknown) => (typeof v === "string" || typeof v === "number" ? v : undefined);

function toFailure(raw: unknown): StockFailure | null {
  if (!isObject(raw)) return null;
  const product: Obj = isObject(raw.product) ? raw.product : {};
  const productId = idOf(raw.productId) ?? idOf(raw.product_id) ?? idOf(product.id) ?? null;
  const name = str(raw.productName) ?? str(raw.product_name) ?? str(product.name) ?? str(raw.name) ?? "";
  const sku = str(raw.sku) ?? str(product.sku) ?? "";
  if (productId === null && !name && !sku) return null; // not about a product
  return {
    productId,
    name,
    sku,
    requested: num(raw.requested) ?? num(raw.requestedQuantity) ?? num(raw.requested_quantity) ?? num(raw.quantity) ?? num(raw.qty) ?? null,
    available:
      num(raw.available) ?? num(raw.availableStock) ?? num(raw.available_stock) ?? num(raw.inStock) ?? num(raw.stock) ?? num(raw.currentStock) ?? null,
  };
}

/**
 * Finds the products that failed in a 409 body. Understands, for example:
 *   { message, errors:   [{ productId, name, requested, available }] }
 *   { message, items:    [...] }  /  details / failures / products / insufficientStock
 *   { message, productId, available }                       (a single product)
 */
export function extractStockFailures(body: unknown): StockFailure[] {
  if (!isObject(body)) return [];
  const lists = [body.errors, body.items, body.details, body.failures, body.products, body.insufficient, body.insufficientStock, body.insufficient_stock];
  const out: StockFailure[] = [];
  for (const l of lists) {
    if (!Array.isArray(l)) continue;
    for (const raw of l) {
      const f = toFailure(raw);
      if (f) out.push(f);
    }
  }
  if (out.length === 0) {
    const single = toFailure(body);
    if (single) out.push(single);
  }
  // one entry per product
  const seen = new Set<string>();
  return out.filter((f) => {
    const k = String(f.productId ?? f.sku ?? f.name);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
