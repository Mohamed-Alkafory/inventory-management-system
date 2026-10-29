export type Id = string | number;

/** A product as shown in the picker: price + live stock. `stock: null` = the API didn't say. */
export interface PickerProduct {
  id: Id;
  name: string;
  sku: string;
  price: number;
  stock: number | null;
  imageUrl?: string | null;
}

export interface DraftLine {
  product: PickerProduct;
  quantity: number;
}

export interface CustomerValues {
  name: string;
  phone: string;
  notes: string;
}

export interface CreateOrderInput {
  customer: { name: string; phone: string };
  notes: string;
  items: Array<{ productId: Id; quantity: number }>;
}

export interface CreatedOrder {
  id: Id | null;
  number: string;
}

/** One product the server could not fulfil (from a 409). */
export interface StockFailure {
  productId: Id | null;
  name: string;
  sku: string;
  requested: number | null;
  available: number | null;
}

/** Same shape for the mock and the real API, so switching is one line. */
export interface OrderBuilderApi {
  searchProducts(search: string): Promise<PickerProduct[]>;
  /** Rejects with ApiError(409) — with per-product details in `error.body` — when stock is insufficient. */
  createOrder(input: CreateOrderInput): Promise<CreatedOrder>;
}
