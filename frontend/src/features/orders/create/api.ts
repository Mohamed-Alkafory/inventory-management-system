import { request } from "../../../lib/http";
import { USE_MOCK } from "../../../lib/env";
import { normalizeStaffOrder } from "../normalize";
import { mockOrderBuilderApi } from "./mockApi";
import type { CreateOrderInput, OrderBuilderApi, PickerProduct } from "./types";

/** One switch for the whole app: the shared `VITE_USE_MOCK` flag (lib/env). */
export { USE_MOCK };

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null;
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const num = (v: unknown) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
};

/** The picker needs price + live stock from the products endpoint (field names below are tolerated). */
export function normalizeProduct(raw: unknown): (PickerProduct & { isActive: boolean }) | null {
  if (!isObject(raw)) return null;
  const inv: Obj = isObject(raw.inventory) ? raw.inventory : {};
  const id = typeof raw.id === "string" || typeof raw.id === "number" ? raw.id : null;
  if (id === null) return null;
  return {
    id,
    name: str(raw.name) ?? "",
    sku: str(raw.sku) ?? "",
    price: num(raw.price) ?? num(raw.unitPrice) ?? num(raw.unit_price) ?? num(raw.sellingPrice) ?? 0,
    stock:
      num(raw.stock) ?? num(raw.currentStock) ?? num(raw.current_stock) ?? num(raw.availableStock) ?? num(raw.available) ?? num(raw.quantity) ?? num(inv.quantity) ?? null,
    imageUrl: str(raw.imageUrl) ?? str(raw.image_url) ?? null,
    isActive: typeof raw.isActive === "boolean" ? raw.isActive : typeof raw.is_active === "boolean" ? raw.is_active : true,
  };
}

function unwrapList(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (isObject(body)) {
    if (Array.isArray(body.data)) return body.data;
    if (Array.isArray(body.items)) return body.items;
  }
  return [];
}

export const realOrderBuilderApi: OrderBuilderApi = {
  async searchProducts(search) {
    // The backend takes `limit`, not `pageSize`; unknown params are rejected.
    const q = new URLSearchParams({ page: "1", limit: "20" });
    if (search.trim()) q.set("search", search.trim());
    return unwrapList(await request<unknown>(`/products?${q}`))
      .map(normalizeProduct)
      .flatMap((p) => (p && p.isActive ? [{ id: p.id, name: p.name, sku: p.sku, price: p.price, stock: p.stock, imageUrl: p.imageUrl }] : []))
      .slice(0, 10);
  },

  /** POST /orders takes flat customer fields; prices/status are server-side. */
  async createOrder(input: CreateOrderInput) {
    const customerName = input.customer.name.trim();
    const customerPhone = input.customer.phone.trim();
    const notes = input.notes.trim();
    const body = {
      items: input.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      ...(customerName ? { customerName } : {}),
      ...(customerPhone ? { customerPhone } : {}),
      ...(notes ? { notes } : {}),
    };
    const resp = await request<unknown>("/orders", { method: "POST", body: JSON.stringify(body) });
    const order = isObject(resp) && isObject(resp.data) ? resp.data : resp; // some APIs wrap the result in { data }
    if (!isObject(order)) return { id: null, number: "" };
    const s = normalizeStaffOrder(order);
    return { id: s.id === "" ? null : s.id, number: s.orderNumber };
  },
};

export const orderBuilderApi: OrderBuilderApi = USE_MOCK ? mockOrderBuilderApi : realOrderBuilderApi;
