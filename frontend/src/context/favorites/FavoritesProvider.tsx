import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { shopStorage } from "../../lib/shopStorage";
import type { ShopProduct } from "../../types/shop";
import { FavoritesContext } from "./favorites-context";
import type { FavoritesContextValue } from "./favorites-context";

export default function FavoritesProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ShopProduct[]>(() => shopStorage.readFavorites());

  useEffect(() => {
    shopStorage.saveFavorites(items);
  }, [items]);

  const has = useCallback((productId: string) => items.some((p) => p.id === productId), [items]);

  const toggle = useCallback((product: ShopProduct) => {
    setItems((rows) =>
      rows.some((row) => row.id === product.id) ? rows.filter((row) => row.id !== product.id) : [...rows, product],
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((rows) => rows.filter((row) => row.id !== productId));
  }, []);

  const value = useMemo<FavoritesContextValue>(
    () => ({ items, has, toggle, remove }),
    [items, has, toggle, remove],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}
