import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../lib/http";
import { ordersApi } from "./api";
import { ordersApi as globalOrdersApi } from "../../api/ordersApi";
import { productKeys } from "../../hooks/useProducts";
import type { CreateOrderInput, CreatedOrder } from "../../types/orders";
import type { Id, OrderAction, OrderListParams } from "./types";

export const orderKeys = {
  all: ["orders"] as const, // the list AND every details page live under this root
  list: (p: OrderListParams) => [...orderKeys.all, "list", p] as const,
  detail: (id: Id) => [...orderKeys.all, "detail", String(id)] as const,
};

export const useOrders = (params: OrderListParams) =>
  useQuery({ queryKey: orderKeys.list(params), queryFn: () => ordersApi.list(params), placeholderData: keepPreviousData });

export const useOrder = (id: Id) =>
  useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => ordersApi.get(id),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 1,
  });

/**
 * Confirm / cancel. Refreshes the list AND the details page afterwards — also when the server
 * refuses (e.g. someone else already changed the status), so the UI never keeps a stale status.
 */
export function useOrderAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: Id; action: OrderAction }) => (action === "confirm" ? ordersApi.confirm(id) : ordersApi.cancel(id)),
    onSettled: () => qc.invalidateQueries({ queryKey: orderKeys.all }),
  });
}

/**
 * Places an order and refreshes the product lists afterwards: the backend
 * deducts stock in the same transaction, so quantities on screen would
 * otherwise go stale. Returns the invalidation promise so the dialog can
 * keep its "placing order" state until the list has been refreshed.
 */
export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (order: CreateOrderInput): Promise<CreatedOrder> => globalOrdersApi.create(order),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.all }),
  });
}
