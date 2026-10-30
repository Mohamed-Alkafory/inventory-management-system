import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { productsApi } from "../api/productsApi";
import { useAuth } from "../context/auth/useAuth";
import type { InventoryProduct, ProductPage, ProductQuery } from "../types/inventory";

export const productKeys = {
  all: ["products"] as const,
  list: (query: ProductQuery) => ["products", "list", query] as const,
  detail: (id: string) => ["products", "detail", id] as const,
  categories: ["products", "categories"] as const,
};

function withoutCost(product: InventoryProduct): InventoryProduct {
  const copy = { ...product };
  delete copy.costPrice;
  return copy;
}

/**
 * One page of products for the given filters.
 * - The previous page stays on screen while the next one loads (no flicker when filtering).
 * - `costPrice` is removed for everyone except ADMIN, so STAFF components never even receive it.
 * - The category name is joined in from the category list (the API only sends `categoryId`).
 */
export function useProducts(query: ProductQuery) {
  const { hasRole } = useAuth();
  const canSeeCost = hasRole("ADMIN");
  const categories = useProductCategories().data;

  const select = useCallback(
    (page: ProductPage): ProductPage => {
      // The backend sends `categoryId` only; show the category name in the table.
      const names = new Map<string, string>((categories ?? []).map((c): [string, string] => [c.id, c.name]));
      const items = page.items.map((p) => {
        const named: InventoryProduct = p.category ? p : { ...p, category: names.get(p.categoryId) ?? "—" };
        return canSeeCost ? named : withoutCost(named);
      });
      return { ...page, items };
    },
    [canSeeCost, categories],
  );

  return useQuery({
    queryKey: productKeys.list(query),
    queryFn: () => productsApi.list(query),
    placeholderData: keepPreviousData,
    select,
  });
}

export function useProductCategories(enabled = true) {
  return useQuery({
    queryKey: productKeys.categories,
    queryFn: () => productsApi.categories(),
    staleTime: 5 * 60_000,
    enabled,
  });
}

/** One product for the detail page. Cost is stripped for STAFF, same as the list. */
export function useProduct(id: string) {
  const { hasRole } = useAuth();
  const canSeeCost = hasRole("ADMIN");
  const categories = useProductCategories().data;

  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => productsApi.get(id),
    select: useCallback(
      (product: InventoryProduct): InventoryProduct => {
        const joined = product.category
          ? product
          : { ...product, category: (categories ?? []).find((c) => c.id === product.categoryId)?.name ?? "" };
        return canSeeCost ? joined : withoutCost(joined);
      },
      [canSeeCost, categories],
    ),
  });
}
