export type PoStatus = "draft" | "ordered" | "partially_received" | "received" | "cancelled";
export type PoAction = "order" | "cancel";
export type Id = string | number;

/** One PO line — names come from the backend's `product` stamp. */
export interface PoLine {
  productId: string;
  name: string;
  sku: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
}

export interface PurchaseOrder {
  id: string;
  number: string; // "PO-0001"
  supplierId: string;
  supplierName: string;
  status: PoStatus;
  total: number;
  /** ISO date-times ("…" when absent). */
  expectedAt: string | null;
  receivedAt: string | null;
  createdAt: string;
}

export interface PurchaseOrderDetails extends PurchaseOrder {
  notes: string | null;
  lines: PoLine[];
}

export interface PoListParams {
  /** "" = all statuses. */
  status: "" | PoStatus;
  /** "" = all suppliers. */
  supplierId: string;
  /** 1-based. */
  page: number;
  pageSize: number;
}

export interface CreatePoInput {
  supplierId: string;
  lines: Array<{ productId: string; quantity: number; unitCost: number }>;
  /** ISO date-time or "" for none. */
  expectedAt?: string;
  notes?: string;
}

export interface ReceiveLineInput {
  productId: string;
  quantity: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
}

/** Same shape whether mock or real, so switching is one line. */
export interface PurchaseOrdersApi {
  list(params: PoListParams): Promise<Paged<PurchaseOrder>>;
  get(id: Id): Promise<PurchaseOrderDetails>;
  /** Creates a DRAFT PO; the backend generates the number and totals. */
  create(input: CreatePoInput): Promise<PurchaseOrderDetails>;
  /** Manual transitions: order (DRAFT→ORDERED) or cancel (DRAFT|ORDERED). */
  transition(id: Id, action: PoAction): Promise<void>;
  /** Partial or full receiving; over-receiving rejects with ApiError 409. */
  receive(id: Id, items: ReceiveLineInput[]): Promise<void>;
}
