import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { shopStorage } from "../../lib/shopStorage";
import type { CartItem, ShopProduct } from "../../types/shop";
import { CartContext, MAX_CART_PRODUCTS, MAX_LINE_QUANTITY } from "./cart-context";
import type { CartContextValue } from "./cart-context";

/** What a caller can show after an addToCart call. */
export type CartAddResult = "added" | "increased" | "capped" | "out_of_stock" | "limit_reached";

export default function CartProvider({ children }: { children: ReactNode }) {
  // Stored lines survive a refresh; legacy/corrupt payloads are sanitised on read.
  const [items, setItems] = useState<CartItem[]>(() => shopStorage.readCart());

  // Mirror for the synchronous result of addToCart (click handlers need an answer now).
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    shopStorage.saveCart(items);
  }, [items]);

  const clamp = (product: ShopProduct, quantity: number): number =>
    Math.max(1, Math.min(quantity, Math.max(product.maxOrderable, 1), MAX_LINE_QUANTITY));

  const addToCart = useCallback((product: ShopProduct, quantity = 1): boolean => {
    const rows = itemsRef.current;
    const existing = rows.find((row) => row.product.id === product.id);
    let outcome: CartAddResult = "added";

    if (product.maxOrderable <= 0) {
      outcome = "out_of_stock";
    } else if (!existing && rows.length >= MAX_CART_PRODUCTS) {
      outcome = "limit_reached";
    } else if (existing) {
      // Refresh the snapshot (price / availability may have changed since it was stored).
      const next = clamp(product, existing.quantity + quantity);
      if (next === existing.quantity) {
        outcome = "capped";
      } else {
        outcome = "increased";
        setItems(
          rows.map((row) => (row.product.id === product.id ? { product, quantity: next } : row)),
        );
      }
    } else {
      setItems([...rows, { product, quantity: clamp(product, quantity) }]);
    }

    return outcome === "added" || outcome === "increased";
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setItems((rows) =>
      rows.map((row) =>
        row.product.id === productId ? { ...row, quantity: clamp(row.product, quantity) } : row,
      ),
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((rows) => rows.filter((row) => row.product.id !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const totalItems = items.reduce((sum, row) => sum + row.quantity, 0);
    const subtotal = items.reduce((sum, row) => sum + row.product.price * row.quantity, 0);
    return { items, totalItems, subtotal, addToCart, setQuantity, remove, clear };
  }, [items, addToCart, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
