import { afterEach, describe, expect, it } from "vitest";
import { tokenStorage } from "../../../api/tokenStorage";
import type { Role } from "../../../types/auth";
import { mockNotificationsApi } from "../mockApi";

const signIn = (id: string, role: Role) =>
  tokenStorage.setSession({
    accessToken: `mock-access.${id}`,
    refreshToken: "mock-refresh",
    user: { id, name: `User ${id}`, email: `${id}@prodexa.com`, role },
  });

const all = { page: 1, pageSize: 20 } as const;

afterEach(() => tokenStorage.clear());

describe("mockNotificationsApi", () => {
  it("seeds a few role-relevant notifications and filters/paginates them", async () => {
    signIn("customer-1", "CUSTOMER");
    const page = await mockNotificationsApi.list(all);
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((n) => ["ORDER_CONFIRMED", "ORDER_CANCELLED"].includes(n.type))).toBe(true);
    expect(page.total).toBe(page.items.length);

    signIn("support-1", "SUPPORT");
    const support = await mockNotificationsApi.list(all);
    expect(support.items.some((n) => n.type === "CONTACT_MESSAGE_RECEIVED")).toBe(true);
    await expect(mockNotificationsApi.list({ ...all, unread: true })).resolves.toMatchObject({
      items: support.items.filter((n) => !n.isRead),
    });
  });

  it("marks one or all rows read and updates the unread count", async () => {
    signIn("admin-1", "ADMIN");
    const before = await mockNotificationsApi.unreadCount();
    expect(before).toBeGreaterThan(0);

    const page = await mockNotificationsApi.list({ ...all, unread: true });
    const updated = await mockNotificationsApi.markRead(page.items[0].id);
    expect(updated.isRead).toBe(true);
    await expect(mockNotificationsApi.unreadCount()).resolves.toBe(before - 1);

    await expect(mockNotificationsApi.markAllRead()).resolves.toBe(before - 1);
    await expect(mockNotificationsApi.unreadCount()).resolves.toBe(0);
  });

  it("persists preference updates per user", async () => {
    signIn("admin-2", "ADMIN");
    const defaults = await mockNotificationsApi.getPreferences();
    expect(defaults).toHaveLength(7);
    expect(defaults.every((p) => p.enabled)).toBe(true);

    const saved = await mockNotificationsApi.updatePreferences([{ type: "LOW_STOCK", enabled: false }]);
    expect(saved.find((p) => p.type === "LOW_STOCK")?.enabled).toBe(false);
    await expect(mockNotificationsApi.getPreferences()).resolves.toEqual(saved);
  });
});
