import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { suppliersApi } from "./api";
import type { SupplierFormValues } from "./schema";
import { toPayload } from "./schema";
import type { Id, SupplierListParams } from "./types";

export const supplierKeys = {
  // Same root key the Products form uses for its supplier <select>, so both refresh together.
  all: ["suppliers"] as const,
  list: (p: SupplierListParams) => [...supplierKeys.all, "list", p] as const,
};

export const useSupplierPage = (params: SupplierListParams) =>
  useQuery({
    queryKey: supplierKeys.list(params),
    queryFn: () => suppliersApi.list(params),
    placeholderData: keepPreviousData, // no flicker while paging / searching
  });

/** Supplier names are shown in the products list, so refresh that too. */
function useRefresh() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: supplierKeys.all }),
      qc.invalidateQueries({ queryKey: ["products"] }),
    ]);
}

export function useSaveSupplier() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, values }: { id?: Id; values: SupplierFormValues }) =>
      id === undefined ? suppliersApi.create(toPayload(values)) : suppliersApi.update(id, toPayload(values)),
    onSuccess: refresh,
  });
}

export function useDeactivateSupplier() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: Id) => suppliersApi.deactivate(id),
    onSuccess: refresh,
  });
}
