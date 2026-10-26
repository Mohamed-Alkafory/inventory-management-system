import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { categoriesApi } from "./api";
import type { CategoryFormValues } from "./schema";
import type { CategoryListParams, Id } from "./types";

export const categoryKeys = {
  // Same root key the Products form uses for its category <select>, so both refresh together.
  all: ["categories"] as const,
  list: (p: CategoryListParams) => [...categoryKeys.all, "list", p] as const,
};

export const useCategoryPage = (params: CategoryListParams) =>
  useQuery({
    queryKey: categoryKeys.list(params),
    queryFn: () => categoriesApi.list(params),
    placeholderData: keepPreviousData, // no flicker while paging / searching
  });

/** Category names are shown in the products list, so refresh that too. */
function useRefresh() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: categoryKeys.all }),
      qc.invalidateQueries({ queryKey: ["products"] }),
    ]);
}

export function useSaveCategory() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, values }: { id?: Id; values: CategoryFormValues }) =>
      id === undefined ? categoriesApi.create(values) : categoriesApi.update(id, values),
    onSuccess: refresh,
  });
}

export function useDeleteCategory() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: Id) => categoriesApi.remove(id),
    onSuccess: refresh,
  });
}
