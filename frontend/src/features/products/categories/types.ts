export type Id = string | number;

export interface Category {
  id: Id;
  name: string;
  productCount: number;
}

export interface CategoryListParams {
  search: string;
  page: number; // 1-based
  pageSize: number;
}

export interface CategoryPage {
  items: Category[];
  total: number;
}

export interface CategoryPayload {
  name: string;
}

/** Same shape for the mock and the real API, so switching is one line. */
export interface CategoriesApi {
  list(params: CategoryListParams): Promise<CategoryPage>;
  create(values: CategoryPayload): Promise<void>;
  update(id: Id, values: CategoryPayload): Promise<void>;
  /** Rejects with ApiError(409) when the category still has products. */
  remove(id: Id): Promise<void>;
}
