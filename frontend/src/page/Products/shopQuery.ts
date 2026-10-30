import type { CatalogQuery } from "../../types/shop";

/*
  Public catalogue state lives in the URL, so a filtered / sorted / paged view
  can be bookmarked, shared and survives refresh + back/forward:

    /products?q=mouse&category=cat-audio&sort=price&dir=desc&page=2&size=20

  Values equal to the defaults are left out of the URL.
*/

export const SHOP_PAGE_SIZES = [10, 20, 50];
export const SHOP_SORT_FIELDS = ["newest", "name", "price"] as const;

export const DEFAULT_SHOP_QUERY: CatalogQuery = {
  search: "",
  category: "",
  sort: "newest",
  order: "desc",
  page: 1,
  pageSize: SHOP_PAGE_SIZES[0],
};

const positiveInt = (value: string | null): number | null => {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isInteger(n) && n >= 1 ? n : null;
};

/** URL → catalog query. Invalid values fall back to defaults. */
export function parseShopQuery(params: URLSearchParams): CatalogQuery {
  const sortParam = params.get("sort");
  const sort = SHOP_SORT_FIELDS.includes(sortParam as CatalogQuery["sort"])
    ? (sortParam as CatalogQuery["sort"])
    : DEFAULT_SHOP_QUERY.sort;
  const size = positiveInt(params.get("size"));

  // `newest` defaults to descending; name/price default to ascending.
  const defaultOrder = sort === "newest" ? "desc" : "asc";
  const dir = params.get("dir");

  return {
    search: (params.get("q") ?? "").trim(),
    category: (params.get("category") ?? "").trim(),
    sort,
    order: dir === "asc" || dir === "desc" ? dir : defaultOrder,
    page: positiveInt(params.get("page")) ?? DEFAULT_SHOP_QUERY.page,
    pageSize: size !== null && SHOP_PAGE_SIZES.includes(size) ? size : DEFAULT_SHOP_QUERY.pageSize,
  };
}

/** Query → URL params (defaults omitted). */
export function toShopSearchParams(query: CatalogQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.search) params.set("q", query.search);
  if (query.category) params.set("category", query.category);
  if (query.sort !== DEFAULT_SHOP_QUERY.sort) params.set("sort", query.sort);
  if (query.order !== (query.sort === "newest" ? "desc" : "asc")) params.set("dir", query.order);
  if (query.page !== DEFAULT_SHOP_QUERY.page) params.set("page", String(query.page));
  if (query.pageSize !== DEFAULT_SHOP_QUERY.pageSize) params.set("size", String(query.pageSize));
  return params;
}

/** True when a search or category filter is applied (sorting and paging don't count). */
export const hasShopFilters = (query: CatalogQuery): boolean => Boolean(query.search || query.category);
