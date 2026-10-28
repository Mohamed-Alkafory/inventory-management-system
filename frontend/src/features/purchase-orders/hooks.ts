import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { productKeys } from "../../hooks/useProducts";
import { inventoryKeys } from "../inventory/hooks";
import { realPurchaseOrdersApi as purchaseOrdersApi } from "./api";
import type { CreatePoInput, Id, PoAction, PoListParams, PurchaseOrdersApi } from "./types";

/**
 * ► CONNECTING THE REAL API
 *   The backend /purchase-orders module is merged, so these hooks call it
 *   directly (no mock). The UI only depends on the `PurchaseOrdersApi`
 *   shape, so a mock can be swapped in later on this one line.
 */
const api: PurchaseOrdersApi = purchaseOrdersApi;

export const poKeys = {
  all: ["purchase-orders"] as const, // every list AND detail live under this root
  list: (p: PoListParams) => [...poKeys.all, "list", p] as const,
  detail: (id: Id) => [...poKeys.all, "detail", String(id)] as const,
};

export const usePurchaseOrders = (params: PoListParams) =>
  useQuery({ queryKey: poKeys.list(params), queryFn: () => api.list(params), placeholderData: keepPreviousData });

export const usePurchaseOrder = (id: Id) =>
  useQuery({
    queryKey: poKeys.detail(id),
    queryFn: () => api.get(id),
    enabled: !!id,
    retry: (count, err) => {
      const status = (err as { status?: number }).status;
      return status !== 404 && count < 1;
    },
  });

/** Create → refresh every PO view (the brand-new draft must show up in the list). */
export function useCreatePo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePoInput) => api.create(input),
    onSettled: () => qc.invalidateQueries({ queryKey: poKeys.all }),
  });
}

/** Place order / cancel → refresh every PO view. */
export function usePoTransition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: Id; action: PoAction }) => api.transition(id, action),
    onSettled: () => qc.invalidateQueries({ queryKey: poKeys.all }),
  });
}

/**
 * Receiving bumps product stock and writes PURCHASE_RECEIPT movements, so
 * the products table and the inventory views are invalidated too — the
 * same habit useCreateOrder has for sales.
 */
export function useReceivePo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, items }: { id: Id; items: Array<{ productId: string; quantity: number }> }) =>
      api.receive(id, items),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: poKeys.all }),
        qc.invalidateQueries({ queryKey: productKeys.all }),
        qc.invalidateQueries({ queryKey: inventoryKeys.all }),
      ]),
  });
}
