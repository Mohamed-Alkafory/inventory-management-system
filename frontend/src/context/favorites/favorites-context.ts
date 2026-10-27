import { createContext } from "react";
import type { InventoryProduct } from "../../types/inventory";

export type FavoritesContextValue = {
  items: InventoryProduct[];
  has: (productId: string) => boolean;
  toggle: (product: InventoryProduct) => void;
  remove: (productId: string) => void;
};

export const FavoritesContext = createContext<FavoritesContextValue | null>(null);
