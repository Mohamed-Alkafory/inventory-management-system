import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { ProductQuery } from "../../types/inventory";
import { DEFAULT_QUERY, hasActiveFilters, parseProductQuery, toSearchParams } from "./productQuery";

type UpdateOptions = {
  /** Replace the history entry instead of adding one (used while typing in the search box). */
  replace?: boolean;
};

/**
 * The product list query, kept in the URL.
 * Changing a filter / sort / page size sends you back to page 1; changing the page does not.
 */
export function useProductFilters() {
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => parseProductQuery(params), [params]);

  const update = useCallback(
    (patch: Partial<ProductQuery>, options: UpdateOptions = {}) => {
      setParams(
        (current) => {
          const base = parseProductQuery(current);
          const next: ProductQuery = { ...base, ...("page" in patch ? {} : { page: 1 }), ...patch };
          return toSearchParams(next);
        },
        { replace: options.replace },
      );
    },
    [setParams],
  );

  /** Clears search / category / stock filters (keeps the sort and page size). */
  const clearFilters = useCallback(
    () => update({ search: DEFAULT_QUERY.search, category: DEFAULT_QUERY.category, status: DEFAULT_QUERY.status }),
    [update],
  );

  return { query, update, clearFilters, hasFilters: hasActiveFilters(query) };
}
