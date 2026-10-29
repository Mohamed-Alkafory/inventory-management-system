import { request } from "../../lib/http";
import { toPayload } from "./schema";
import type { ProductFormValues } from "./schema";
import type { Id, Option, Product } from "./types";

/** Accepts `[...]`, `{ data: [...] }` or `{ items: [...] }`. */
function unwrapList<T>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  if (typeof body === "object" && body !== null) {
    const b = body as { data?: unknown; items?: unknown };
    if (Array.isArray(b.data)) return b.data as T[];
    if (Array.isArray(b.items)) return b.items as T[];
  }
  return [];
}

export const fetchProducts = async () => unwrapList<Product>(await request<unknown>("/products"));
export const fetchCategories = async () => unwrapList<Option>(await request<unknown>("/categories"));
export const fetchSuppliers = async () => unwrapList<Option>(await request<unknown>("/suppliers"));

export const createProduct = (values: ProductFormValues) =>
  request<Product>("/products", { method: "POST", body: JSON.stringify(toPayload(values)) });

export const updateProduct = (id: Id, values: ProductFormValues) =>
  request<Product>(`/products/${id}`, { method: "PATCH", body: JSON.stringify(toPayload(values)) });

/** Soft delete: the server deactivates the product instead of removing the row. */
export const deleteProduct = (id: Id) => request<void>(`/products/${id}`, { method: "DELETE" });

/**
 * Uploads/replaces the product picture. `request` deliberately leaves the
 * Content-Type unset for FormData so the browser adds the multipart boundary.
 */
export function uploadProductImage(id: Id, file: File) {
  const body = new FormData();
  body.append("image", file);
  return request<Product>(`/products/${id}/image`, { method: "POST", body });
}

/** Clears the product picture (the backend also deletes the local file). */
export const deleteProductImage = (id: Id) => request<void>(`/products/${id}/image`, { method: "DELETE" });
