import { PRODUCT_SORT_FIELDS, STOCK_STATUSES } from "../../types/inventory";
import type { ProductQuery, ProductSortField, StockStatus } from "../../types/inventory";

/*
  The products list state lives in the URL, so a filtered / sorted / paged view can be
  bookmarked, shared and survives refresh + back/forward:

    /products?q=mouse&category=Accessories&stock=low_stock&sort=price&dir=desc&page=2&size=20

  Values equal to the defaults are left out of the URL to keep it short.
*/

export const PAGE_SIZES = [10, 20, 50];

export const DEFAULT_QUERY: ProductQuery = {
  search: "",
  category: "",
  status: "",
  sortBy: null,
  sortDir: "asc",
  page: 1,
  pageSize: PAGE_SIZES[0],
};

const positiveInt = (value: string | null): number | null => {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isInteger(n) && n >= 1 ? n : null;
};

/** URL → query. Anything invalid falls back to the default, so a hand-edited URL never breaks the page. */
export function parseProductQuery(params: URLSearchParams): ProductQuery {
  const status = params.get("stock");
  const sort = params.get("sort");
  const size = positiveInt(params.get("size"));

  const sortBy = PRODUCT_SORT_FIELDS.includes(sort as ProductSortField) ? (sort as ProductSortField) : null;

  return {
    search: (params.get("q") ?? "").trim(),
    category: (params.get("category") ?? "").trim(),
    status: STOCK_STATUSES.includes(status as StockStatus) ? (status as StockStatus) : "",
    sortBy,
    sortDir: sortBy && params.get("dir") === "desc" ? "desc" : "asc",
    page: positiveInt(params.get("page")) ?? DEFAULT_QUERY.page,
    pageSize: size !== null && PAGE_SIZES.includes(size) ? size : DEFAULT_QUERY.pageSize,
  };
}

/** Query → URL params (defaults omitted). */
export function toSearchParams(query: ProductQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.search) params.set("q", query.search);
  if (query.category) params.set("category", query.category);
  if (query.status) params.set("stock", query.status);
  if (query.sortBy) {
    params.set("sort", query.sortBy);
    params.set("dir", query.sortDir);
  }
  if (query.page !== DEFAULT_QUERY.page) params.set("page", String(query.page));
  if (query.pageSize !== DEFAULT_QUERY.pageSize) params.set("size", String(query.pageSize));
  return params;
}

/** True when a search / category / stock filter is applied (sorting and paging don't count). */
export const hasActiveFilters = (query: ProductQuery): boolean =>
  Boolean(query.search || query.category || query.status);
