import { useContext } from "react";
import { FavoritesContext } from "./favorites-context";

/** const { items, has, toggle } = useFavorites(); */
export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used inside <FavoritesProvider>");
  return ctx;
}
