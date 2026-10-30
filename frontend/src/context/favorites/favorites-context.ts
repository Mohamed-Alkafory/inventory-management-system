import { createContext } from "react";
import type { ShopProduct } from "../../types/shop";

export type FavoritesContextValue = {
  items: ShopProduct[];
  has: (productId: string) => boolean;
  toggle: (product: ShopProduct) => void;
  remove: (productId: string) => void;
};

export const FavoritesContext = createContext<FavoritesContextValue | null>(null);
