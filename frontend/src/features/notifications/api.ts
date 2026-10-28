import { http } from "../../api/http";
import { NOTIFICATION_ENDPOINTS } from "../../api/endpoints";
import { withMock } from "../../api/mockSwitch";
import { ALL_NOTIFICATION_TYPES } from "./types";
import type { NotificationPreference, NotificationsApi } from "./types";

export const realNotificationsApi: NotificationsApi = {
  async preferences() {
    const { data } = await http.get(NOTIFICATION_ENDPOINTS.preferences);
    return data;
  },

  async updatePreferences(preferences) {
    const { data } = await http.put(NOTIFICATION_ENDPOINTS.preferences, { preferences });
    return data;
  },
};

/** In-memory demo store — defaults on, resets when the page reloads. */
const mockState: NotificationPreference[] = ALL_NOTIFICATION_TYPES.map((type) => ({ type, enabled: true }));

export const mockNotificationsApi: NotificationsApi = {
  async preferences() {
    return [...mockState];
  },

  async updatePreferences(preferences) {
    for (const preference of preferences) {
      const existing = mockState.find((row) => row.type === preference.type);
      if (existing) existing.enabled = preference.enabled;
    }
    return [...mockState];
  },
};

export const notificationsApi: NotificationsApi = withMock(realNotificationsApi, mockNotificationsApi);
