import { request } from "../../lib/http";
import { USE_MOCK } from "../../lib/env";
import { mockInventoryApi } from "./mockApi";
import { toItemPage, toMovementPage } from "./normalize";
import type { InventoryApi, InventoryListParams, MovementListParams, Option } from "./types";

/**
 * One switch for the whole app: the shared `VITE_USE_MOCK` flag (lib/env).
 * Re-exported so existing `USE_MOCK` imports keep working.
 */
export { USE_MOCK };

function qs(entries: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(entries)) if (v !== undefined && String(v).trim() !== "") q.set(k, String(v).trim());
  return q.toString();
}

const listQuery = (p: InventoryListParams) =>
  // The backend list is `GET /products` (contract §3.4): it takes `limit`
  // (not `pageSize`) and lowercase stock-status tokens; unknown params are
  // rejected outright by `forbidNonWhitelisted`.
  qs({ page: p.page, limit: p.pageSize, search: p.search, categoryId: p.categoryId, stockStatus: p.status ? p.status : undefined });

// `createdAt` range: expand local calendar days to full-day bounds.
const dayFrom = (d: string) => (d.trim() ? `${d}T00:00:00` : undefined);
const dayTo = (d: string) => (d.trim() ? `${d}T23:59:59` : undefined);

const movementsQuery = (p: MovementListParams) =>
  // `GET /stock/movements` (contract §3.6): page/limit + productId + the
  // full-day from/to range. The movement `type` enum has no single value
  // for increase/decrease, so the sign filter is applied client-side after
  // normalizing (see realInventoryApi.movements).
  qs({ page: p.page, limit: p.pageSize, productId: p.productId !== undefined ? p.productId : undefined, from: dayFrom(p.from), to: dayTo(p.to) });

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
    return toItemPage(await request<unknown>(`/products?${listQuery(p)}`), p);
  },
  async movements(p) {
    const page = await toMovementPage(await request<unknown>(`/stock/movements?${movementsQuery(p)}`), p);
    if (p.type) {
      // The backend's movement types don't collapse to increase/decrease
      // (PURCHASE_RECEIPT/RETURN add stock, SALE removes, ADJUSTMENT does
      // both), so the sign filter happens here on the signed change.
      const wantIncrease = p.type === "increase";
      return { ...page, items: page.items.filter((m) => (wantIncrease ? m.change > 0 : m.change < 0)) };
    }
    return page;
  },
  async categories() {
    return toOptions(await request<unknown>("/categories"));
  },
  /** `POST /stock/adjustments` — signed quantityChange + required reason. */
  async adjust(productId, payload) {
    await request<unknown>("/stock/adjustments", {
      method: "POST",
      body: JSON.stringify({ productId: String(productId), quantityChange: payload.change, reason: payload.reason }),
    });
  },
};

export const inventoryApi: InventoryApi = USE_MOCK ? mockInventoryApi : realInventoryApi;
