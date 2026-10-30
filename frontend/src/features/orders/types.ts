export type Id = string | number;

/** The backend's three lifecycle states. No processing/shipped/delivered. */
export type OrderStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

export type OrderAction = "confirm" | "cancel";

/** Which API/route family a screen is using. */
export type OrderScope = "my" | "staff";

export interface Paged<T> {
  items: T[];
  total: number;
}

/** Customer-safe line snapshot — deliberately has no internal ids. */
export interface CustomerOrderItem {
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/** Memory-safe order shape returned by /orders/mine*. */
export interface CustomerOrder {
  id: Id;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  items: CustomerOrderItem[];
  recipientName?: string;
  recipientPhone?: string;
  shippingAddress?: string;
  shippingCity?: string;
  paymentMethod?: string;
  createdAt: string;
  cancelledAt?: string;
}

/** Staff/support/admin line snapshot (detail + create responses). */
export interface StaffOrderItem {
  id?: Id;
  productId?: Id;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/**
 * Staff/support/admin order shape. Phone and shipping fields are optional
 * because SUPPORT list rows omit customerPhone, recipientPhone and
 * shippingAddress (data minimization on the backend).
 */
export interface StaffOrder {
  id: Id;
  orderNumber: string;
  status: OrderStatus;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  totalAmount: number;
  customerId?: string;
  recipientName?: string;
  recipientPhone?: string;
  shippingAddress?: string;
  shippingCity?: string;
  paymentMethod?: string;
  createdById?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt?: string;
  /** Only detail (and create) responses carry these. */
  items?: StaffOrderItem[];
  createdBy?: { id: string; name: string; email?: string };
  stockMovements?: Array<{
    id: string;
    productId: string;
    type: string;
    quantityChange: number;
    quantityAfter: number;
    reason?: string;
    createdAt: string;
  }>;
}

/** One internal note on an order (GET/POST /orders/:id/notes). */
export interface OrderNote {
  id: string;
  orderId: string;
  authorId?: string;
  note: string;
  author?: { id: string; name: string };
  createdAt: string;
}

/** Staff/support/admin list filters. */
export interface OrderListParams {
  search: string;
  status: "" | OrderStatus;
  from: string; // YYYY-MM-DD or ""
  to: string;
  page: number; // 1-based
  pageSize: number;
}

/** Customer "my orders" filters — the backend only supports status + pagination. */
export interface MyOrderListParams {
  status: "" | OrderStatus;
  page: number;
  pageSize: number;
}

/** Payload for POST /orders/mine — never prices, statuses or customer ids. */
export interface CreateMyOrderInput {
  items: Array<{ productId: string; quantity: number }>;
  recipientName: string;
  recipientPhone: string;
  shippingAddress: string;
  shippingCity: string;
  notes?: string;
}

export interface CustomerOrdersApi {
  listMyOrders(params: MyOrderListParams): Promise<Paged<CustomerOrder>>;
  /** A missing or foreign order both reject with ApiError(404). */
  getMyOrder(id: Id): Promise<CustomerOrder>;
  /** Rejects with ApiError(409) unless the order is owned and PENDING. */
  cancelMyOrder(id: Id): Promise<void>;
  /** Places one order for the signed-in customer; stock failures are 409. */
  createMyOrder(input: CreateMyOrderInput): Promise<CustomerOrder>;
}

export interface StaffOrdersApi {
  listOrders(params: OrderListParams): Promise<Paged<StaffOrder>>;
  getOrder(id: Id): Promise<StaffOrder>;
  /** PATCH /orders/:id/status — PENDING→CONFIRMED, PENDING/CONFIRMED→CANCELLED. */
  updateOrderStatus(id: Id, status: "CONFIRMED" | "CANCELLED"): Promise<void>;
  /** POST /orders/:id/cancel — PENDING only (SUPPORT/STAFF/ADMIN). */
  cancelOrder(id: Id): Promise<void>;
  /** GET /orders/:id/notes — oldest first, never paginated. */
  listNotes(id: Id): Promise<OrderNote[]>;
  /** POST /orders/:id/notes — internal, trimmed, 1–2000 chars. */
  addNote(id: Id, note: string): Promise<OrderNote>;
}
