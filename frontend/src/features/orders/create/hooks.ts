import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orderKeys } from "../hooks";
import { orderBuilderApi } from "./api";
import type { CreateOrderInput } from "./types";

export const pickerKeys = {
  all: ["order-products"] as const,
  search: (q: string) => [...pickerKeys.all, q] as const,
};

/** Live availability: refreshed every 30 s, when the tab regains focus, and after every order attempt. */
export const useProductSearch = (search: string) =>
  useQuery({
    queryKey: pickerKeys.search(search.trim()),
    queryFn: () => orderBuilderApi.searchProducts(search),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

/**
 * After an attempt — successful OR refused with a 409 — refresh the picker's stock, the orders
 * list and the inventory, so nothing on screen keeps showing stale numbers.
 */
export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrderInput) => orderBuilderApi.createOrder(input),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: pickerKeys.all }),
        qc.invalidateQueries({ queryKey: orderKeys.all }),
        qc.invalidateQueries({ queryKey: ["inventory"] }),
      ]),
  });
}
