import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { CatalogQuery } from "../../types/shop";
import { DEFAULT_SHOP_QUERY, hasShopFilters, parseShopQuery, toShopSearchParams } from "./shopQuery";

type UpdateOptions = {
  /** Replace the history entry instead of adding one (used while typing in the search box). */
  replace?: boolean;
};

/** Public catalogue query, kept in the URL. Filter changes reset paging to page 1. */
export function useShopFilters() {
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => parseShopQuery(params), [params]);

  const update = useCallback(
    (patch: Partial<CatalogQuery>, options: UpdateOptions = {}) => {
      setParams(
        (current) => {
          const base = parseShopQuery(current);
          const next: CatalogQuery = { ...base, ...("page" in patch ? {} : { page: 1 }), ...patch };
          return toShopSearchParams(next);
        },
        { replace: options.replace },
      );
    },
    [setParams],
  );

  const clearFilters = useCallback(
    () => update({ search: DEFAULT_SHOP_QUERY.search, category: DEFAULT_SHOP_QUERY.category }),
    [update],
  );

  return { query, update, clearFilters, hasFilters: hasShopFilters(query) };
}
