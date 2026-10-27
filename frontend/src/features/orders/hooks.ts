import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ordersApi } from "../../api/ordersApi";
import { productKeys } from "../../hooks/useProducts";
import type { CreateOrderInput, CreatedOrder } from "../../types/orders";

export const orderKeys = {
  all: ["orders"] as const,
};

/**
 * Places an order and refreshes the product lists afterwards: the backend
 * deducts stock in the same transaction, so quantities on screen would
 * otherwise go stale. Returns the invalidation promise so the dialog can
 * keep its "placing order" state until the list has been refreshed.
 */
export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (order: CreateOrderInput): Promise<CreatedOrder> => ordersApi.create(order),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.all }),
  });
}
