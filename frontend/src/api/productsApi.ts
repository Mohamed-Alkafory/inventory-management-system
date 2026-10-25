import type { ProductCategory, ProductPage, ProductQuery } from "../types/inventory";
import { PRODUCT_ENDPOINTS } from "./endpoints";
import { http } from "./http";
import { mockProductsApi } from "./mock/productsMock";
import { withMock } from "./mockSwitch";
import { MAX_CATEGORY_LIMIT, toCategories, toListParams, toProductPage } from "./productMappers";

export type ProductsApi = {
  /** One page of products; filtering, sorting and paging happen on the server. */
  list(query: ProductQuery): Promise<ProductPage>;
  /** Categories for the filter dropdown and for showing the category name in the table. */
  categories(): Promise<ProductCategory[]>;
};

const realProductsApi: ProductsApi = {
  async list(query) {
    const { data } = await http.get(PRODUCT_ENDPOINTS.list, { params: toListParams(query) });
    return toProductPage(data);
  },

  async categories() {
    const { data } = await http.get(PRODUCT_ENDPOINTS.categories, { params: { limit: MAX_CATEGORY_LIMIT } });
    return toCategories(data);
  },
};

export const productsApi = withMock(realProductsApi, mockProductsApi);
