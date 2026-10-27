export type Id = string | number;
export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";
export type OrderAction = "confirm" | "cancel";

export interface OrderSummary {
  id: Id;
  number: string; // "ORD-1001"
  customerName: string;
  createdAt: string; // ISO date-time
  total: number;
  status: OrderStatus;
  /** Optional: when the server says which actions are allowed, we trust it over our own rules. */
  allowedActions?: OrderAction[];
}

export interface OrderItem {
  productId: Id | null;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
}

export interface StatusEvent {
  status: OrderStatus;
  at: string;
  by: string;
  note: string;
}

export interface OrderDetails extends OrderSummary {
  customerEmail: string;
  createdBy: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  history: StatusEvent[];
}

export interface OrderListParams {
  search: string; // order number or customer
  status: "" | OrderStatus;
  from: string; // YYYY-MM-DD or ""
  to: string;
  page: number; // 1-based
  pageSize: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
}

/** Same shape for the mock and the real API, so switching is one line. */
export interface OrdersApi {
  list(params: OrderListParams): Promise<Paged<OrderSummary>>;
  get(id: Id): Promise<OrderDetails>;
  /** Rejects with ApiError(409) when the transition isn't allowed for the current status. */
  confirm(id: Id): Promise<void>;
  cancel(id: Id): Promise<void>;
}
