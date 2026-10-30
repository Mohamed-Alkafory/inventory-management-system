import { createContext } from "react";
import { MAX_CART_PRODUCTS, MAX_LINE_QUANTITY } from "../../lib/shopStorage";
import type { CartItem, ShopProduct } from "../../types/shop";

export { MAX_CART_PRODUCTS, MAX_LINE_QUANTITY };

export type CartContextValue = {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  /** Adds a product (or increases its quantity when already present). False when it cannot be ordered. */
  addToCart: (product: ShopProduct, quantity?: number) => boolean;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

export const CartContext = createContext<CartContextValue | null>(null);
