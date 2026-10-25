import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createProduct, deleteProduct, fetchCategories, fetchProducts, fetchSuppliers, updateProduct } from "./api";
import type { ProductFormValues } from "./schema";
import type { Id } from "./types";

export const productKeys = {
  all: ["products"] as const,
  list: () => [...productKeys.all, "list"] as const,
};

export const useProducts = () => useQuery({ queryKey: productKeys.list(), queryFn: fetchProducts });

export const useCategories = () =>
  useQuery({ queryKey: ["categories"], queryFn: fetchCategories, staleTime: 5 * 60_000 });

export const useSuppliers = () =>
  useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers, staleTime: 5 * 60_000 });

/**
 * Both mutations return the invalidation promise, so the dialog stays in its
 * "saving" state until the list has been refreshed.
 */
export function useSaveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: Id; values: ProductFormValues }) =>
      id === undefined ? createProduct(values) : updateProduct(id, values),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.all }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => deleteProduct(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.all }),
  });
}
