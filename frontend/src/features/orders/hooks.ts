import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../lib/http";
import { customerOrdersApi, staffOrdersApi } from "./api";
import { ordersApi as globalOrdersApi } from "../../api/ordersApi";
import { productKeys } from "../../hooks/useProducts";
import type { CreateOrderInput, CreatedOrder } from "../../types/orders";
import type { CreateMyOrderInput, Id, MyOrderListParams, OrderListParams, OrderNote } from "./types";

/**
 * Both scopes live under the ["orders"] root so a new order can refresh every
 * list at once (useCreateOrder), but lists/details are otherwise separate.
 */
const ROOT = ["orders"] as const;

export const myOrderKeys = {
  all: [...ROOT, "my"] as const,
  list: (p: MyOrderListParams) => [...myOrderKeys.all, "list", p] as const,
  detail: (id: Id) => [...myOrderKeys.all, "detail", String(id)] as const,
};

export const staffOrderKeys = {
  all: [...ROOT, "staff"] as const,
  list: (p: OrderListParams) => [...staffOrderKeys.all, "list", p] as const,
  detail: (id: Id) => [...staffOrderKeys.all, "detail", String(id)] as const,
  notes: (id: Id) => [...staffOrderKeys.all, "notes", String(id)] as const,
};

export const orderKeys = {
  all: ROOT,
  my: myOrderKeys,
  staff: staffOrderKeys,
};

type EnabledOptions = { enabled?: boolean };

/* ------------------------------- CUSTOMER ------------------------------- */

export const useMyOrders = (params: MyOrderListParams, options: EnabledOptions = {}) =>
  useQuery({
    queryKey: myOrderKeys.list(params),
    queryFn: () => customerOrdersApi.listMyOrders(params),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
  });

export const useMyOrder = (id: Id, options: EnabledOptions = {}) =>
  useQuery({
    queryKey: myOrderKeys.detail(id),
    queryFn: () => customerOrdersApi.getMyOrder(id),
    enabled: (options.enabled ?? true) && Boolean(id),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 1,
  });

export function useCancelMyOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => customerOrdersApi.cancelMyOrder(id),
    onSettled: () => qc.invalidateQueries({ queryKey: myOrderKeys.all }),
  });
}

/**
 * Customer checkout: POST /orders/mine. Stock is deducted server-side, so the
 * product catalogue and every own-order list are refreshed on success.
 */
export function useCreateMyOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (order: CreateMyOrderInput) => customerOrdersApi.createMyOrder(order),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: productKeys.all }),
        qc.invalidateQueries({ queryKey: myOrderKeys.all }),
      ]),
  });
}

/* ---------------------------- STAFF / SUPPORT ---------------------------- */

export const useOrders = (params: OrderListParams, options: EnabledOptions = {}) =>
  useQuery({
    queryKey: staffOrderKeys.list(params),
    queryFn: () => staffOrdersApi.listOrders(params),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
  });

export const useOrder = (id: Id, options: EnabledOptions = {}) =>
  useQuery({
    queryKey: staffOrderKeys.detail(id),
    queryFn: () => staffOrdersApi.getOrder(id),
    enabled: (options.enabled ?? true) && Boolean(id),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 1,
  });

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: Id; status: "CONFIRMED" | "CANCELLED" }) =>
      staffOrdersApi.updateOrderStatus(id, status),
    onSettled: () => qc.invalidateQueries({ queryKey: staffOrderKeys.all }),
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => staffOrdersApi.cancelOrder(id),
    onSettled: () => qc.invalidateQueries({ queryKey: staffOrderKeys.all }),
  });
}

/** Internal note thread for one order (oldest first). */
export const useOrderNotes = (id: Id, options: EnabledOptions = {}) =>
  useQuery({
    queryKey: staffOrderKeys.notes(id),
    queryFn: () => staffOrdersApi.listNotes(id),
    enabled: (options.enabled ?? true) && Boolean(id),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 1,
  });

/**
 * Append an internal note. The created note is put straight into the cached
 * thread (optimistic refresh), then the notes/detail queries are revalidated
 * so the server remains the source of truth.
 */
export function useAddOrderNote(id: Id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note: string) => staffOrdersApi.addNote(id, note),
    onSuccess: (note: OrderNote) => {
      qc.setQueryData(staffOrderKeys.notes(id), (old: OrderNote[] | undefined) =>
        old ? [...old, note] : [note],
      );
      return Promise.all([
        qc.invalidateQueries({ queryKey: staffOrderKeys.notes(id) }),
        qc.invalidateQueries({ queryKey: staffOrderKeys.detail(id) }),
      ]);
    },
  });
}

/**
 * Places an order and refreshes the caches afterwards: the backend deducts
 * stock in the same transaction, so product quantities and every orders list
 * would otherwise go stale. Returns the invalidation promise so the dialog can
 * keep its "placing order" state until the lists have been refreshed. */
export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (order: CreateOrderInput): Promise<CreatedOrder> => globalOrdersApi.create(order),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: productKeys.all }),
        qc.invalidateQueries({ queryKey: orderKeys.all }),
      ]),
  });
}
