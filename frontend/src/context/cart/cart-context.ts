import { createContext } from "react";
import type { InventoryProduct } from "../../types/inventory";
import type { CartItem } from "../../types/shop";

export type CartContextValue = {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  /** Adds a product (or increases its quantity when already present). False when stock is exhausted. */
  addToCart: (product: InventoryProduct, quantity?: number) => boolean;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

export const CartContext = createContext<CartContextValue | null>(null);
