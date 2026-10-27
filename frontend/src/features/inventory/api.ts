import { request } from "../../lib/http";
import { mockInventoryApi } from "./mockApi";
import { toItemPage, toMovementPage } from "./normalize";
import type { InventoryApi, InventoryListParams, MovementListParams, Option } from "./types";

/**
 * ► CONNECTING THE REAL API
 *   When the backend is merged, set  VITE_USE_MOCK_API=false  in your .env
 *   (the same switch the categories and suppliers pages use). Nothing else changes.
 */
export const USE_MOCK = import.meta.env?.VITE_USE_MOCK_API !== "false";

function qs(entries: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(entries)) if (v !== undefined && String(v).trim() !== "") q.set(k, String(v).trim());
  return q.toString();
}

const listQuery = (p: InventoryListParams) =>
  qs({ page: p.page, pageSize: p.pageSize, search: p.search, categoryId: p.categoryId, status: p.status });

const movementsQuery = (p: MovementListParams) =>
  qs({ page: p.page, pageSize: p.pageSize, productId: p.productId, search: p.search, type: p.type, from: p.from, to: p.to });

function toOptions(body: unknown): Option[] {
  const arr = Array.isArray(body)
    ? body
    : typeof body === "object" && body !== null
      ? ((body as { data?: unknown; items?: unknown }).data ?? (body as { items?: unknown }).items)
      : [];
  return (Array.isArray(arr) ? arr : []).flatMap((c) =>
    c && typeof c === "object" && "id" in c && "name" in c ? [{ id: (c as Option).id, name: String((c as Option).name) }] : [],
  );
}

export const realInventoryApi: InventoryApi = {
  async list(p) {
    return toItemPage(await request<unknown>(`/inventory?${listQuery(p)}`), p);
  },
  async movements(p) {
    return toMovementPage(await request<unknown>(`/inventory/movements?${movementsQuery(p)}`), p);
  },
  async categories() {
    return toOptions(await request<unknown>("/categories"));
  },
  /** If your API uses another route for adjustments, change only this line. */
  async adjust(productId, payload) {
    await request<unknown>(`/inventory/${productId}/adjustments`, { method: "POST", body: JSON.stringify(payload) });
  },
};

export const inventoryApi: InventoryApi = USE_MOCK ? mockInventoryApi : realInventoryApi;
