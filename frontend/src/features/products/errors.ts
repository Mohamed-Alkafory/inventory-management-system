import type { ProductField } from "./schema";

export type FieldErrors = Partial<Record<ProductField, string>>;

export class ApiError extends Error {
  status: number;
  fieldErrors: FieldErrors;

  constructor(status: number, message: string, fieldErrors: FieldErrors = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/** API field name → form field name. Add your server's names here if they differ. */
const FIELD_MAP: Record<string, ProductField> = {
  sku: "sku",
  name: "name",
  price: "price",
  costPrice: "costPrice",
  cost_price: "costPrice",
  categoryId: "categoryId",
  category_id: "categoryId",
  category: "categoryId",
  supplierId: "supplierId",
  supplier_id: "supplierId",
  supplier: "supplierId",
  minStock: "minStock",
  min_stock: "minStock",
  imageUrl: "imageUrl",
  image_url: "imageUrl",
  barcode: "barcode",
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function text(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return text(v[0]);
  if (isObject(v) && typeof v.message === "string") return v.message;
  return undefined;
}

function mapField(raw: unknown): ProductField | undefined {
  const key = Array.isArray(raw) ? raw[0] : raw;
  if (typeof key !== "string") return undefined;
  const last = key.split(".").pop() ?? key;
  return FIELD_MAP[last];
}

/**
 * Understands the common validation-error shapes:
 *   { errors: { sku: "Already exists" } }            { errors: { sku: ["Already exists"] } }
 *   { errors: [{ field: "sku", message: "..." }] }   { field: "sku", message: "..." }
 */
export function extractFieldErrors(body: unknown): FieldErrors {
  const out: FieldErrors = {};
  if (!isObject(body)) return out;

  const bag = body.errors ?? body.details ?? body.fieldErrors;
  if (Array.isArray(bag)) {
    for (const item of bag) {
      if (!isObject(item)) continue;
      const field = mapField(item.field ?? item.path ?? item.param);
      const msg = text(item.message ?? item.msg);
      if (field && msg && !out[field]) out[field] = msg;
    }
  } else if (isObject(bag)) {
    for (const [k, v] of Object.entries(bag)) {
      const field = mapField(k);
      const msg = text(v);
      if (field && msg) out[field] = msg;
    }
  }

  const single = mapField(body.field);
  const singleMsg = text(body.message);
  if (single && singleMsg && !out[single]) out[single] = singleMsg;

  return out;
}

export function extractMessage(body: unknown, fallback: string): string {
  if (isObject(body)) return text(body.message) ?? text(body.error) ?? fallback;
  return fallback;
}
