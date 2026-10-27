import { useContext } from "react";
import { CartContext } from "./cart-context";

/** const { items, addToCart, setQuantity, remove, clear } = useCart(); */
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
