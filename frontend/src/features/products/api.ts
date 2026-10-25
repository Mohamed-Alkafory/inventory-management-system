import { ApiError, extractFieldErrors, extractMessage } from "./errors";
import { toPayload } from "./schema";
import type { ProductFormValues } from "./schema";
import type { Id, Option, Product } from "./types";

const BASE = import.meta.env?.VITE_API_URL ?? "";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      credentials: "include", // TODO: or add `Authorization: Bearer <token>` below if you use tokens
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new ApiError(0, "Can’t reach the server. Check your connection and try again.");
  }

  const raw = await res.text();
  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, extractMessage(body, `Request failed (${res.status})`), extractFieldErrors(body));
  }
  return body as T;
}

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
  request<Product>(`/products/${id}`, { method: "PUT", body: JSON.stringify(toPayload(values)) });

/** Soft delete: the server deactivates the product instead of removing the row. */
export const deleteProduct = (id: Id) => request<void>(`/products/${id}`, { method: "DELETE" });
