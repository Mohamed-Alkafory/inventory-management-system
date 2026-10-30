import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { catalogApi } from "../api/catalogApi";
import { ApiError } from "../lib/http";
import type { CatalogQuery } from "../types/shop";

export const catalogKeys = {
  all: ["catalog"] as const,
  list: (query: CatalogQuery) => ["catalog", "list", query] as const,
  detail: (id: string) => ["catalog", "detail", id] as const,
  categories: ["catalog", "categories"] as const,
};

/** 404/429 should surface immediately instead of burning the 30/min budget with retries. */
function retryCatalog(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 404 || error.status === 429)) return false;
  return failureCount < 2;
}

/** One public catalog page; keeps the previous page on screen while the next one loads. */
export function useCatalogProducts(query: CatalogQuery) {
  return useQuery({
    queryKey: catalogKeys.list(query),
    queryFn: () => catalogApi.list(query),
    placeholderData: keepPreviousData,
    retry: retryCatalog,
  });
}

/** One public product; unknown/inactive products answer 404 and are not retried. */
export function useCatalogProduct(id: string) {
  return useQuery({
    queryKey: catalogKeys.detail(id),
    queryFn: () => catalogApi.get(id),
    retry: retryCatalog,
    enabled: Boolean(id),
  });
}

/** Public categories for the shop filter and the header menu (no token needed). */
export function useCatalogCategories() {
  return useQuery({
    queryKey: catalogKeys.categories,
    queryFn: () => catalogApi.categories(),
    staleTime: 5 * 60_000,
    retry: retryCatalog,
  });
}
