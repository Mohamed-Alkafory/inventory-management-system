import { filterMyOrders, filterOrders, paginate } from "./filters";
import { STATUSES } from "./status";
import type {
  CustomerOrder,
  CustomerOrderItem,
  MyOrderListParams,
  OrderListParams,
  OrderNote,
  OrderStatus,
  Paged,
  StaffOrder,
  StaffOrderItem,
} from "./types";

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null;
/** Non-empty string or undefined — personal fields must never render as "". */
const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v : undefined);
const num = (v: unknown) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
};
const idOf = (v: unknown) => (typeof v === "string" || typeof v === "number" ? v : undefined);
const arr = (...c: unknown[]): unknown[] => (c.find(Array.isArray) as unknown[] | undefined) ?? [];
const hasArray = (...c: unknown[]): boolean => c.some(Array.isArray);

export function readStatus(v: unknown): OrderStatus | undefined {
  const raw = str(v)?.toUpperCase().trim();
  if (!raw) return undefined;
  if (raw === "CANCELED") return "CANCELLED";
  return STATUSES.find((s) => s === raw);
}

function readCreatedBy(v: unknown): StaffOrder["createdBy"] {
  if (typeof v === "string") return v.trim() ? { id: "", name: v } : undefined;
  if (!isObject(v)) return undefined;
  const id = str(v.id);
  const name = str(v.name);
  if (!id && !name) return undefined;
  return { id: id ?? "", name: name ?? "", email: str(v.email) };
}

const lineTotalOf = (item: CustomerOrderItem) =>
  item.lineTotal || Math.round(item.quantity * item.unitPrice * 100) / 100;

function normalizeCustomerItem(raw: unknown): CustomerOrderItem {
  const r: Obj = isObject(raw) ? raw : {};
  const product = isObject(r.product) ? r.product : {};
  const quantity = num(r.quantity) ?? num(r.qty) ?? 0;
  const unitPrice = num(r.unitPrice) ?? num(r.unit_price) ?? num(r.price) ?? 0;
  return {
    productName: str(r.productName) ?? str(r.product_name) ?? str(r.name) ?? str(product.name) ?? "",
    sku: str(r.sku) ?? str(product.sku) ?? "",
    quantity,
    unitPrice,
    lineTotal: num(r.lineTotal) ?? num(r.line_total) ?? Math.round(quantity * unitPrice * 100) / 100,
  };
}

/**
 * Customer-safe shape from GET /orders/mine*.
 * Tolerates missing fields: optional personal data is undefined, never "".
 */
export function normalizeCustomerOrder(raw: unknown): CustomerOrder {
  const r: Obj = isObject(raw) ? raw : {};
  const id = idOf(r.id) ?? "";
  const items = arr(r.items, r.orderItems, r.order_items, r.lines).map(normalizeCustomerItem);
  const computed = items.reduce((sum, item) => sum + lineTotalOf(item), 0);
  return {
    id,
    orderNumber:
      str(r.orderNumber) ?? str(r.order_number) ?? str(r.number) ?? str(r.code) ?? (id ? `ORD-${id}` : ""),
    status: readStatus(r.status) ?? "PENDING",
    totalAmount: num(r.totalAmount) ?? num(r.total_amount) ?? num(r.total) ?? Math.round(computed * 100) / 100,
    items,
    recipientName: str(r.recipientName) ?? str(r.recipient_name) ?? undefined,
    recipientPhone: str(r.recipientPhone) ?? str(r.recipient_phone) ?? undefined,
    shippingAddress: str(r.shippingAddress) ?? str(r.shipping_address) ?? undefined,
    shippingCity: str(r.shippingCity) ?? str(r.shipping_city) ?? undefined,
    paymentMethod: str(r.paymentMethod) ?? str(r.payment_method) ?? undefined,
    createdAt: str(r.createdAt) ?? str(r.created_at) ?? "",
    cancelledAt: str(r.cancelledAt) ?? str(r.cancelled_at) ?? undefined,
  };
}

function normalizeStaffItem(raw: unknown): StaffOrderItem {
  const r: Obj = isObject(raw) ? raw : {};
  const product = isObject(r.product) ? r.product : {};
  const quantity = num(r.quantity) ?? num(r.qty) ?? 0;
  const unitPrice = num(r.unitPrice) ?? num(r.unit_price) ?? num(r.price) ?? 0;
  return {
    id: idOf(r.id),
    productId: idOf(r.productId) ?? idOf(r.product_id) ?? idOf(product.id),
    productName: str(r.productName) ?? str(r.product_name) ?? str(r.name) ?? str(product.name) ?? "",
    sku: str(r.sku) ?? str(product.sku) ?? "",
    quantity,
    unitPrice,
    lineTotal: num(r.lineTotal) ?? num(r.line_total) ?? Math.round(quantity * unitPrice * 100) / 100,
  };
}

function normalizeMovements(v: unknown): NonNullable<StaffOrder["stockMovements"]> | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.map((raw) => {
    const r: Obj = isObject(raw) ? raw : {};
    return {
      id: String(idOf(r.id) ?? ""),
      productId: String(idOf(r.productId) ?? idOf(r.product_id) ?? ""),
      type: String(str(r.type) ?? ""),
      quantityChange: num(r.quantityChange) ?? num(r.quantity_change) ?? 0,
      quantityAfter: num(r.quantityAfter) ?? num(r.quantity_after) ?? 0,
      reason: str(r.reason),
      createdAt: str(r.createdAt) ?? str(r.created_at) ?? "",
    };
  });
}

/**
 * Staff/support/admin shape from GET /orders and GET /orders/:id.
 * List rows may omit phone/address fields and items; every field is optional
 * except the common order scalars.
 */
export function normalizeStaffOrder(raw: unknown): StaffOrder {
  const r: Obj = isObject(raw) ? raw : {};
  const id = idOf(r.id) ?? "";
  const createdBy = r.createdBy ?? r.created_by;

  return {
    id,
    orderNumber:
      str(r.orderNumber) ?? str(r.order_number) ?? str(r.number) ?? str(r.code) ?? (id ? `ORD-${id}` : ""),
    status: readStatus(r.status) ?? "PENDING",
    customerName: str(r.customerName) ?? str(r.customer_name) ?? str(r.customer) ?? undefined,
    customerPhone: str(r.customerPhone) ?? str(r.customer_phone) ?? undefined,
    notes: str(r.notes) ?? str(r.note) ?? undefined,
    totalAmount: num(r.totalAmount) ?? num(r.total_amount) ?? num(r.total) ?? 0,
    customerId: str(r.customerId) ?? str(r.customer_id) ?? undefined,
    recipientName: str(r.recipientName) ?? str(r.recipient_name) ?? undefined,
    recipientPhone: str(r.recipientPhone) ?? str(r.recipient_phone) ?? undefined,
    shippingAddress: str(r.shippingAddress) ?? str(r.shipping_address) ?? undefined,
    shippingCity: str(r.shippingCity) ?? str(r.shipping_city) ?? undefined,
    paymentMethod: str(r.paymentMethod) ?? str(r.payment_method) ?? undefined,
    createdById: str(r.createdById) ?? str(r.created_by_id) ?? undefined,
    cancelledAt: str(r.cancelledAt) ?? str(r.cancelled_at) ?? undefined,
    createdAt: str(r.createdAt) ?? str(r.created_at) ?? "",
    updatedAt: str(r.updatedAt) ?? str(r.updated_at) ?? undefined,
    items: hasArray(r.items, r.orderItems, r.order_items, r.lines)
      ? arr(r.items, r.orderItems, r.order_items, r.lines).map(normalizeStaffItem)
      : undefined,
    createdBy: readCreatedBy(createdBy),
    stockMovements: normalizeMovements(r.stockMovements ?? r.stock_movements),
  };
}

/** GET/POST /orders/:id/notes — one internal note with its author snapshot. */
export function normalizeOrderNote(raw: unknown): OrderNote {
  const r: Obj = isObject(raw) ? raw : {};
  const author = isObject(r.author) ? r.author : {};
  const authorId = str(r.authorId) ?? str(r.author_id) ?? str(author.id);
  const authorName = str(author.name) ?? str(r.authorName) ?? str(r.author_name);
  return {
    id: String(idOf(r.id) ?? ""),
    orderId: String(idOf(r.orderId) ?? idOf(r.order_id) ?? ""),
    authorId,
    note: str(r.note) ?? str(r.body) ?? "",
    author: authorId || authorName ? { id: authorId ?? "", name: authorName ?? "" } : undefined,
    createdAt: str(r.createdAt) ?? str(r.created_at) ?? "",
  };
}

/** Total from `{ data | items, meta.total | total }`, or a plain array. */
function pageOf<T>(body: unknown, map: (raw: unknown) => T, fallback: () => Paged<T>): Paged<T> {
  if (Array.isArray(body)) return fallback();
  const b: Obj = isObject(body) ? body : {};
  const meta: Obj = isObject(b.meta) ? b.meta : {};
  const pagination: Obj = isObject(b.pagination) ? b.pagination : {};
  const items = arr(b.items, b.data).map(map);
  return {
    items,
    total: num(b.total) ?? num(meta.total) ?? num(pagination.total) ?? num(b.count) ?? items.length,
  };
}

export function toCustomerOrderPage(body: unknown, p: MyOrderListParams): Paged<CustomerOrder> {
  return pageOf(body, normalizeCustomerOrder, () =>
    paginate(filterMyOrders(arr(body).map(normalizeCustomerOrder), p), p.page, p.pageSize),
  );
}

export function toStaffOrderPage(body: unknown, p: OrderListParams): Paged<StaffOrder> {
  return pageOf(body, normalizeStaffOrder, () =>
    paginate(filterOrders(arr(body).map(normalizeStaffOrder), p), p.page, p.pageSize),
  );
}
