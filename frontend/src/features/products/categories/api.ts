import { request } from "../../../lib/http";
import { USE_MOCK } from "../../../lib/env";
import { mockCategoriesApi } from "./mockApi";
import { toPage } from "./normalize";
import type { CategoriesApi, CategoryListParams } from "./types";

/**
 * One switch for the whole app: the shared `VITE_USE_MOCK` flag (lib/env).
 * Re-exported so existing `USE_MOCK` imports keep working.
 */
export { USE_MOCK };

function buildQuery(p: CategoryListParams) {
  // The API contract uses `limit`, not the UI's `pageSize`.
  const q = new URLSearchParams({ page: String(p.page), limit: String(p.pageSize) });
  if (p.search.trim()) q.set("search", p.search.trim());
  return q.toString();
}

export const realCategoriesApi: CategoriesApi = {
  async list(p) {
    return toPage(await request<unknown>(`/categories?${buildQuery(p)}`), p);
  },
  async create(values) {
    await request<unknown>("/categories", { method: "POST", body: JSON.stringify(values) });
  },
  async update(id, values) {
    await request<unknown>(`/categories/${id}`, { method: "PATCH", body: JSON.stringify(values) });
  },
  async remove(id) {
    await request<unknown>(`/categories/${id}`, { method: "DELETE" });
  },
};

export const categoriesApi: CategoriesApi = USE_MOCK ? mockCategoriesApi : realCategoriesApi;
