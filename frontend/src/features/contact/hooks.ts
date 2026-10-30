import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../lib/http";
import { contactMessagesApi } from "./api";
import type { ContactListParams, ContactUpdateInput, Id } from "./types";

export const contactKeys = {
  all: ["contact-messages"] as const,
  list: (p: ContactListParams) => [...contactKeys.all, "list", p] as const,
  detail: (id: Id) => [...contactKeys.all, "detail", String(id)] as const,
};

export const useContactMessages = (params: ContactListParams) =>
  useQuery({
    queryKey: contactKeys.list(params),
    queryFn: () => contactMessagesApi.list(params),
    placeholderData: keepPreviousData,
  });

export const useContactMessage = (id: Id) =>
  useQuery({
    queryKey: contactKeys.detail(id),
    queryFn: () => contactMessagesApi.get(id),
    enabled: Boolean(id),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 1,
  });

/** Triage a message; the updated row replaces the cached detail and every list refreshes. */
export function useUpdateContactMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: Id; patch: ContactUpdateInput }) => contactMessagesApi.update(id, patch),
    onSuccess: (message) => {
      qc.setQueryData(contactKeys.detail(message.id), message);
      return qc.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
}
