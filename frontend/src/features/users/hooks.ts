import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditKeys } from "../audit/hooks";
import { usersApi } from "./api";
import type { CreateUserInput, Id, UpdateUserInput, UserListParams } from "./types";

export const usersKeys = {
  all: ["users"] as const, // also feeds the audit "user" filter and Suppliers-like selects
  list: (p: UserListParams) => [...usersKeys.all, "list", p] as const,
};

export const useUsers = (params: UserListParams) =>
  useQuery({ queryKey: usersKeys.list(params), queryFn: () => usersApi.list(params), placeholderData: keepPreviousData });

/**
 * Every user mutation rewrites what the audit trail shows (user.updated /
 * user.deactivated), so the audit views are invalidated too.
 */
function useRefreshUsers() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: usersKeys.all }), qc.invalidateQueries({ queryKey: auditKeys.all })]);
}

export function useCreateUser() {
  const invalidate = useRefreshUsers();
  return useMutation({
    mutationFn: (input: CreateUserInput) => usersApi.create(input),
    onSettled: () => invalidate(),
  });
}

export function useUpdateUser() {
  const invalidate = useRefreshUsers();
  return useMutation({
    mutationFn: ({ id, patch }: { id: Id; patch: UpdateUserInput }) => usersApi.update(id, patch),
    onSettled: () => invalidate(),
  });
}

export function useDeactivateUser() {
  const invalidate = useRefreshUsers();
  return useMutation({
    mutationFn: (id: Id) => usersApi.deactivate(id),
    onSettled: () => invalidate(),
  });
}
