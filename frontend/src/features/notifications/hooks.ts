import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { notificationsApi } from "./api";
import type {
  NotificationItem,
  NotificationListParams,
  NotificationPage,
  NotificationPreferenceInput,
} from "./types";

/** Unread-count poll interval (the task allows 30–60 s). */
export const UNREAD_POLL_MS = 45_000;

export const notificationKeys = {
  all: ["notifications"] as const,
  lists: ["notifications", "list"] as const,
  list: (params: NotificationListParams) => [...notificationKeys.lists, params] as const,
  unread: ["notifications", "unread-count"] as const,
  preferences: ["notifications", "preferences"] as const,
};

/** Tracks tab visibility so polling can pause in a hidden tab. */
export function useDocumentVisible() {
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden",
  );

  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return visible;
}

export const useNotifications = (params: NotificationListParams, enabled = true) =>
  useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => notificationsApi.list(params),
    placeholderData: keepPreviousData,
    enabled,
  });

/**
 * The bell's unread count. It polls every {UNREAD_POLL_MS} while the tab is
 * visible and stops completely while hidden or signed out.
 */
export function useUnreadCount(enabled = true) {
  const visible = useDocumentVisible();
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: () => notificationsApi.unreadCount(),
    enabled,
    refetchInterval: enabled && visible ? UNREAD_POLL_MS : false,
    refetchIntervalInBackground: false,
  });
}

export const useNotificationPreferences = (enabled = true) =>
  useQuery({
    queryKey: notificationKeys.preferences,
    queryFn: () => notificationsApi.getPreferences(),
    enabled,
  });

function updatePageItem(page: NotificationPage | undefined, id: string, patch: Partial<NotificationItem>) {
  if (!page) return page;
  return { ...page, items: page.items.map((n) => (n.id === id ? { ...n, ...patch } : n)) };
}

/** Mark one notification read; cached lists and the unread count update in place. */
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: (updated) => {
      const pages = qc.getQueriesData<NotificationPage>({ queryKey: notificationKeys.lists });
      const wasUnread = pages.some(([, page]) => page?.items.some((n) => n.id === updated.id && !n.isRead));

      qc.setQueriesData<NotificationPage>({ queryKey: notificationKeys.lists }, (page) =>
        updatePageItem(page, updated.id, updated),
      );

      if (wasUnread) {
        qc.setQueryData<{ count: number }>(notificationKeys.unread, (old) =>
          old ? { count: Math.max(0, old.count - 1) } : old,
        );
      }
    },
  });
}

/** Mark every unread notification read; cached pages and the badge reset immediately. */
export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      const readAt = new Date().toISOString();
      qc.setQueriesData<NotificationPage>({ queryKey: notificationKeys.lists }, (page) =>
        page
          ? { ...page, items: page.items.map((n) => (n.isRead ? n : { ...n, isRead: true, readAt })) }
          : page,
      );
      qc.setQueryData<{ count: number }>(notificationKeys.unread, { count: 0 });
    },
  });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (preferences: NotificationPreferenceInput[]) =>
      notificationsApi.updatePreferences(preferences),
    onSuccess: (preferences) => {
      qc.setQueryData(notificationKeys.preferences, preferences);
    },
  });
}
