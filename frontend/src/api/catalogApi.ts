import { request } from "../lib/http";
import type { CatalogCategory, CatalogPage, CatalogQuery, ShopProduct } from "../types/shop";
import { CATALOG_ENDPOINTS } from "./endpoints";
import { toCatalogCategories, toCatalogPage, toCatalogParams, toShopProduct } from "./catalogMappers";
import { mockCatalogApi } from "./mock/catalogMock";
import { withMock } from "./mockSwitch";

export type CatalogApi = {
  /** One public page; search/filter/sort/paging happen on the server. */
  list(query: CatalogQuery): Promise<CatalogPage>;
  /** One active product; unknown/inactive answers 404. */
  get(id: string): Promise<ShopProduct>;
  /** Active categories for the filter and the header menu. */
  categories(): Promise<CatalogCategory[]>;
};

const realCatalogApi: CatalogApi = {
  async list(query) {
    const data = await request<unknown>(`${CATALOG_ENDPOINTS.products}?${new URLSearchParams(
      Object.entries(toCatalogParams(query)).map(([k, v]) => [k, String(v)]),
    ).toString()}`);
    return toCatalogPage(data, query);
  },

  async get(id) {
    const data = await request<unknown>(`${CATALOG_ENDPOINTS.products}/${encodeURIComponent(id)}`);
    return toShopProduct(data);
  },

  async categories() {
    const data = await request<unknown>(`${CATALOG_ENDPOINTS.categories}?limit=50`);
    return toCatalogCategories(data);
  },
};

export const catalogApi = withMock(realCatalogApi, mockCatalogApi);
