export type Id = string | number;
export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export interface Option {
  id: Id;
  name: string;
}

export interface InventoryItem {
  id: Id; // product id
  name: string;
  sku: string;
  imageUrl?: string | null;
  categoryId: Id | null;
  categoryName: string;
  currentStock: number;
  reorderPoint: number;
  status: StockStatus;
}

export interface StockMovement {
  id: Id;
  productId: Id;
  productName: string;
  sku: string;
  /** Signed: positive = stock added, negative = stock removed. */
  change: number;
  stockAfter: number | null;
  reason: string;
  createdAt: string; // ISO date-time
  createdBy: string;
}

export interface InventoryListParams {
  search: string;
  categoryId: string; // "" = all
  status: "" | StockStatus;
  page: number; // 1-based
  pageSize: number;
}

export interface MovementListParams {
  productId?: Id; // set → history of one product, otherwise global
  search: string; // global history only
  type: "" | "increase" | "decrease";
  from: string; // YYYY-MM-DD or ""
  to: string; // YYYY-MM-DD or ""
  page: number;
  pageSize: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
}

export interface AdjustPayload {
  change: number;
  reason: string;
}

/** Same shape for the mock and the real API, so switching is one line. */
export interface InventoryApi {
  list(params: InventoryListParams): Promise<Paged<InventoryItem>>;
  movements(params: MovementListParams): Promise<Paged<StockMovement>>;
  categories(): Promise<Option[]>;
  /** Rejects with ApiError when stock would go below zero. */
  adjust(productId: Id, payload: AdjustPayload): Promise<void>;
}
