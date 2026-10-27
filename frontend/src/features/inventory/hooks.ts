import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { inventoryApi } from "./api";
import type { AdjustPayload, Id, InventoryListParams, MovementListParams } from "./types";

export const inventoryKeys = {
  all: ["inventory"] as const, // the stock table AND every movements list live under this root
  list: (p: InventoryListParams) => [...inventoryKeys.all, "stock", p] as const,
  movements: (p: MovementListParams) => [...inventoryKeys.all, "movements", p] as const,
  categories: () => [...inventoryKeys.all, "categories"] as const,
};

export const useInventory = (params: InventoryListParams) =>
  useQuery({ queryKey: inventoryKeys.list(params), queryFn: () => inventoryApi.list(params), placeholderData: keepPreviousData });

export const useMovements = (params: MovementListParams) =>
  useQuery({ queryKey: inventoryKeys.movements(params), queryFn: () => inventoryApi.movements(params), placeholderData: keepPreviousData });

export const useInventoryCategories = () =>
  useQuery({ queryKey: inventoryKeys.categories(), queryFn: () => inventoryApi.categories(), staleTime: 5 * 60_000 });

/**
 * One invalidation refreshes the table and every history list, so an adjustment shows up
 * everywhere without a reload. Returning the promise keeps the dialog "saving" until then.
 */
export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, ...payload }: AdjustPayload & { productId: Id }) => inventoryApi.adjust(productId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.all }),
  });
}
