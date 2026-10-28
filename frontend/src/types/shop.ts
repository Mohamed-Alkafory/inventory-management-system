import type { InventoryProduct } from "./inventory";

/**
 * Client-side shopping state. Products are stored as full `InventoryProduct`
 * snapshots (localStorage), so cards render straight from the stored data.
 * The authoritative price and stock come from the server again at checkout.
 */
export type CartItem = {
  product: InventoryProduct;
  quantity: number;
};
