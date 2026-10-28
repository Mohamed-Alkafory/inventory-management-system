import { request } from "../../lib/http";
import type { CreatePoInput, PoListParams, PoLine, PoStatus, PurchaseOrder, PurchaseOrderDetails, PurchaseOrdersApi } from "./types";

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null;
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const num = (v: unknown) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
};
const iso = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export function readStatus(v: unknown): PoStatus {
  const s = str(v)?.toLowerCase().trim();
  switch (s) {
    case "draft":
    case "ordered":
    case "partially_received":
    case "received":
    case "cancelled":
      return s;
    default:
      return "draft";
  }
}

function normalizeLine(raw: unknown): PoLine {
  const r: Obj = isObject(raw) ? raw : {};
  const product: Obj = isObject(r.product) ? r.product : {};
  return {
    productId: str(r.productId) ?? "",
    name: str(product.name) ?? str(r.productName) ?? "",
    sku: str(product.sku) ?? "",
    quantityOrdered: num(r.quantityOrdered) ?? 0,
    quantityReceived: num(r.quantityReceived) ?? 0,
    unitCost: num(r.unitCost) ?? 0,
  };
}

function normalizePo(raw: unknown): PurchaseOrder {
  const r: Obj = isObject(raw) ? raw : {};
  const supplier: Obj = isObject(r.supplier) ? r.supplier : {};
  return {
    id: str(r.id) ?? "",
    number: str(r.orderNumber) ?? str(r.number) ?? "",
    supplierId: str(r.supplierId) ?? "",
    supplierName: str(supplier.companyName) ?? "",
    status: readStatus(r.status),
    total: num(r.totalAmount) ?? num(r.total) ?? 0,
    expectedAt: iso(r.expectedAt),
    receivedAt: iso(r.receivedAt),
    createdAt: str(r.createdAt) ?? "",
  };
}

export function normalizeDetails(raw: unknown): PurchaseOrderDetails {
  return {
    ...normalizePo(raw),
    notes: isObject(raw) ? (str(raw.notes) ?? null) : null,
    lines: (Array.isArray((raw as Obj)?.items) ? ((raw as Obj).items as unknown[]) : []).map(normalizeLine),
  };
}

/** `{ data: [...], meta: { total, … } }` — the §1 counter-operation envelope. */
function unpack(body: unknown): { items: unknown[]; total?: number } {
  const b: Obj = isObject(body) ? body : {};
  const meta: Obj = isObject(b.meta) ? b.meta : {};
  const items = Array.isArray(b.data) ? b.data : Array.isArray(b.items) ? b.items : [];
  return { items, total: num(b.total) ?? num(meta.total) };
}

function listQuery(p: PoListParams) {
  // Backend pagination/contract: page + limit (not pageSize); filters only when set.
  const q = new URLSearchParams({ page: String(p.page), limit: String(p.pageSize) });
  if (p.status) q.set("status", p.status.toUpperCase());
  if (p.supplierId) q.set("supplierId", p.supplierId);
  return q.toString();
}

export const realPurchaseOrdersApi: PurchaseOrdersApi = {
  async list(p) {
    const { items, total } = unpack(await request<unknown>(`/purchase-orders?${listQuery(p)}`));
    return { items: items.map(normalizePo), total: total ?? items.length };
  },
  async get(id) {
    return normalizeDetails(await request<unknown>(`/purchase-orders/${id}`));
  },
  async create(input: CreatePoInput) {
    return normalizeDetails(
      await request<unknown>("/purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          supplierId: input.supplierId,
          items: input.lines.map((l) => ({ productId: l.productId, quantityOrdered: l.quantity, unitCost: l.unitCost })),
          ...(input.expectedAt ? { expectedAt: input.expectedAt } : {}),
          ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
        }),
      }),
    );
  },
  async transition(id, action) {
    // Manual moves only: DRAFT → ORDERED, DRAFT|ORDERED → CANCELLED (409 otherwise).
    const newStatus = action === "order" ? "ORDERED" : "CANCELLED";
    await request<unknown>(`/purchase-orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ newStatus }) });
  },
  async receive(id, items) {
    // Over-receiving answers 409; DRAFT/CANCELLED/RECEIVED orders are refused too.
    await request<unknown>(`/purchase-orders/${id}/receive`, { method: "POST", body: JSON.stringify({ items }) });
  },
};
