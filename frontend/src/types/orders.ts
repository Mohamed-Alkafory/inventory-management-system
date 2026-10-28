/** Payload for POST /orders. Prices/totals are computed server-side. */
export type CreateOrderInput = {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
};

/** Snapshot of one line as the backend echoes it back. */
export type CreatedOrderItem = {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

/** What POST /orders answers with (201) — everything the success toast needs. */
export type CreatedOrder = {
  id: string;
  orderNumber: string;
  totalAmount: number;
  items: CreatedOrderItem[];
};
