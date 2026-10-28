import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "./api";
import type { NotificationPreference } from "./types";

export const notificationKeys = {
  all: ["notifications"] as const,
  preferences: ["notifications", "preferences"] as const,
};

/** GET /notifications/preferences — every type, defaulting to enabled. */
export const useNotificationPreferences = () =>
  useQuery({ queryKey: notificationKeys.preferences, queryFn: () => notificationsApi.preferences() });

/**
 * PUT /notifications/preferences with an optimistic toggle inside the cache:
 * the switch flips instantly, and a failed request is rolled back so the
 * row never lies about what the server has stored.
 */
export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (preferences: Array<Pick<NotificationPreference, "type" | "enabled">>) =>
      notificationsApi.updatePreferences(preferences),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: notificationKeys.preferences });
      const previous = qc.getQueryData<NotificationPreference[]>(notificationKeys.preferences);
      qc.setQueryData<NotificationPreference[]>(notificationKeys.preferences, (current) =>
        (current ?? []).map((row) => {
          const change = next.find((n) => n.type === row.type);
          return change ? { ...row, enabled: change.enabled } : row;
        }),
      );
      return { previous };
    },
    onError: (_error, _next, context) => {
      if (context?.previous) qc.setQueryData(notificationKeys.preferences, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.preferences }),
  });
}
