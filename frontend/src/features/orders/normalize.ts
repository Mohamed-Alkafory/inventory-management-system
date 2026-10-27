import { filterOrders, paginate } from "./filters";
import { ACTION_RULES, STATUSES } from "./status";
import type {
  OrderAction,
  OrderDetails,
  OrderItem,
  OrderListParams,
  OrderStatus,
  OrderSummary,
  Paged,
  StatusEvent,
} from "./types";

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null;
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const num = (v: unknown) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v); // decimals often arrive as strings
  return undefined;
};
const person = (...c: unknown[]): string | undefined => {
  for (const v of c) {
    const name = typeof v === "string" ? v : isObject(v) ? str(v.name) : undefined;
    if (name) return name;
  }
  return undefined;
};
const idOf = (v: unknown) => (typeof v === "string" || typeof v === "number" ? v : undefined);
const arr = (...c: unknown[]): unknown[] => (c.find(Array.isArray) as unknown[] | undefined) ?? [];

export function readStatus(v: unknown): OrderStatus | undefined {
  let s = str(v)?.toLowerCase().trim();
  if (s === "canceled") s = "cancelled";
  return STATUSES.find((x) => x === s);
}

function readActions(v: unknown): OrderAction[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const known = Object.keys(ACTION_RULES) as OrderAction[];
  return v.map((x) => String(x).toLowerCase()).filter((x): x is OrderAction => known.includes(x as OrderAction));
}

export function normalizeSummary(raw: unknown): OrderSummary {
  const r: Obj = isObject(raw) ? raw : {};
  const customer = isObject(r.customer) ? r.customer : {};
  const id = idOf(r.id) ?? "";
  return {
    id,
    number: str(r.number) ?? str(r.orderNumber) ?? str(r.order_number) ?? str(r.code) ?? `ORD-${id}`,
    customerName: str(customer.name) ?? str(r.customerName) ?? str(r.customer_name) ?? str(r.customer) ?? "",
    createdAt: str(r.createdAt) ?? str(r.created_at) ?? str(r.date) ?? "",
    total: num(r.total) ?? num(r.totalAmount) ?? num(r.total_amount) ?? 0,
    status: readStatus(r.status) ?? "pending",
    allowedActions: readActions(r.allowedActions ?? r.allowed_actions),
  };
}

function normalizeItem(raw: unknown): OrderItem {
  const r: Obj = isObject(raw) ? raw : {};
  const product = isObject(r.product) ? r.product : {};
  return {
    productId: idOf(r.productId) ?? idOf(r.product_id) ?? idOf(product.id) ?? null,
    name: str(r.name) ?? str(r.productName) ?? str(r.product_name) ?? str(product.name) ?? "",
    sku: str(r.sku) ?? str(product.sku) ?? "",
    quantity: num(r.quantity) ?? num(r.qty) ?? 0,
    unitPrice: num(r.unitPrice) ?? num(r.unit_price) ?? num(r.price) ?? 0,
  };
}

function normalizeEvent(raw: unknown): StatusEvent {
  const r: Obj = isObject(raw) ? raw : {};
  return {
    status: readStatus(r.status) ?? readStatus(r.to) ?? "pending",
    at: str(r.at) ?? str(r.createdAt) ?? str(r.created_at) ?? str(r.date) ?? "",
    by: person(r.changedBy, r.changed_by, r.by, r.user, r.createdBy, r.created_by) ?? "",
    note: str(r.note) ?? str(r.comment) ?? str(r.reason) ?? "",
  };
}

export function normalizeDetails(raw: unknown): OrderDetails {
  const base = normalizeSummary(raw);
  const r: Obj = isObject(raw) ? raw : {};
  const customer = isObject(r.customer) ? r.customer : {};
    const items = arr(r.items, r.orderItems, r.order_items, r.lines).map(normalizeItem);
  const subtotal = num(r.subtotal) ?? items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const shipping = num(r.shipping) ?? num(r.shippingCost) ?? num(r.shipping_cost) ?? 0;
  const tax = num(r.tax) ?? num(r.taxAmount) ?? num(r.tax_amount) ?? 0;
  const discount = num(r.discount) ?? 0;
  const hasTotal = num(r.total) ?? num(r.totalAmount) ?? num(r.total_amount);
  return {
    ...base,
    total: hasTotal ?? subtotal + shipping + tax - discount,
    customerEmail: str(customer.email) ?? str(r.customerEmail) ?? str(r.customer_email) ?? "",
    createdBy: person(r.createdBy, r.created_by, r.creator, r.creatorName) ?? "",
    items,
    subtotal,
    shipping,
    tax,
    discount,
    history: arr(r.statusHistory, r.status_history, r.history, r.events, r.timeline).map(normalizeEvent),
  };
}

/** `[...]` or `{ items | data: [...], total | meta.total | pagination.total | count }`. */
export function toOrderPage(body: unknown, p: OrderListParams): Paged<OrderSummary> {
  if (Array.isArray(body)) return paginate(filterOrders(body.map(normalizeSummary), p), p.page, p.pageSize); // no server paging → do it here
  const b: Obj = isObject(body) ? body : {};
  const meta: Obj = isObject(b.meta) ? b.meta : {};
  const pagination: Obj = isObject(b.pagination) ? b.pagination : {};
  const items = arr(b.items, b.data).map(normalizeSummary);
  return { items, total: num(b.total) ?? num(meta.total) ?? num(pagination.total) ?? num(b.count) ?? items.length };
}
