import { USE_MOCK } from "../../lib/env";
import { request } from "../../lib/http";
import { mockNotificationsApi } from "./mockApi";
import { normalizeNotification, toNotificationPage, toNotificationPreferences } from "./normalize";
import type {
  NotificationListParams,
  NotificationPreferenceInput,
  NotificationsApi,
} from "./types";

export { USE_MOCK };

function listQuery(params: NotificationListParams): string {
  // The backend rejects unknown query params, so only documented ones are sent.
  const q = new URLSearchParams({
    page: String(params.page),
    limit: String(params.pageSize),
  });
  if (params.unread !== undefined) q.set("unread", String(params.unread));
  if (params.type) q.set("type", params.type);
  if (params.sortBy) q.set("sortBy", params.sortBy);
  if (params.sortOrder) q.set("sortOrder", params.sortOrder);
  return q.toString();
}

const encode = (id: string) => encodeURIComponent(id);

export const realNotificationsApi: NotificationsApi = {
  async list(params) {
    return toNotificationPage(await request<unknown>(`/notifications?${listQuery(params)}`));
  },

  async unreadCount() {
    const body = await request<{ count?: unknown }>("/notifications/unread-count");
    const count = Number(body?.count);
    return Number.isFinite(count) && count >= 0 ? count : 0;
  },

  async markRead(id) {
    return normalizeNotification(
      await request<unknown>(`/notifications/${encode(id)}/read`, { method: "PATCH" }),
    );
  },

  async markAllRead() {
    const body = await request<{ updated?: unknown }>("/notifications/read-all", { method: "PATCH" });
    const updated = Number(body?.updated);
    return Number.isFinite(updated) && updated >= 0 ? updated : 0;
  },

  async getPreferences() {
    return toNotificationPreferences(await request<unknown>("/notifications/preferences"));
  },

  async updatePreferences(preferences: NotificationPreferenceInput[]) {
    return toNotificationPreferences(
      await request<unknown>("/notifications/preferences", {
        method: "PUT",
        body: JSON.stringify({ preferences }),
      }),
    );
  },
};

export const notificationsApi: NotificationsApi = USE_MOCK ? mockNotificationsApi : realNotificationsApi;
