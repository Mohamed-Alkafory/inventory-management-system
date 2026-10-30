import { afterEach, describe, expect, it, vi } from "vitest";
import { realNotificationsApi } from "../api";
import type { NotificationPreferenceInput } from "../types";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const row = {
  id: "n-1",
  type: "ORDER_CONFIRMED",
  title: "Order confirmed",
  message: "Order ORD-1 is now CONFIRMED.",
  entityType: "order",
  entityId: "o-1",
  isRead: false,
  readAt: null,
  createdAt: "2026-10-30T10:00:00.000Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("realNotificationsApi", () => {
  it("lists notifications with only documented query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: [row], meta: { page: 2, limit: 10, total: 12, totalPages: 2 } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const page = await realNotificationsApi.list({
      page: 2,
      pageSize: 10,
      unread: true,
      type: "ORDER_CONFIRMED",
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    const url = new URL(fetchMock.mock.calls[0][0] as string, "http://localhost");
    expect(url.pathname).toBe("/api/v1/notifications");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: "2",
      limit: "10",
      unread: "true",
      type: "ORDER_CONFIRMED",
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    expect(page).toMatchObject({ page: 2, pageSize: 10, total: 12, totalPages: 2 });
    expect(page.items[0]).toMatchObject({ id: "n-1", isRead: false, entityType: "order" });
  });

  it("omits unread when the filter is neutral", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [], meta: {} }));
    vi.stubGlobal("fetch", fetchMock);

    await realNotificationsApi.list({ page: 1, pageSize: 20 });

    const url = new URL(fetchMock.mock.calls[0][0] as string, "http://localhost");
    expect(url.searchParams.has("unread")).toBe(false);
  });

  it("reads the unread count and marks one/all read", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ count: 4 }))
      .mockResolvedValueOnce(jsonResponse({ ...row, isRead: true, readAt: "2026-10-30T11:00:00.000Z" }))
      .mockResolvedValueOnce(jsonResponse({ updated: 3 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(realNotificationsApi.unreadCount()).resolves.toBe(4);
    await expect(realNotificationsApi.markRead("n-1")).resolves.toMatchObject({ id: "n-1", isRead: true });
    await expect(realNotificationsApi.markAllRead()).resolves.toBe(3);

    const [countUrl] = fetchMock.mock.calls[0] as [string];
    const [readUrl, readInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    const [allUrl, allInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(new URL(countUrl, "http://localhost").pathname).toBe("/api/v1/notifications/unread-count");
    expect(new URL(readUrl, "http://localhost").pathname).toBe("/api/v1/notifications/n-1/read");
    expect(readInit.method).toBe("PATCH");
    expect(new URL(allUrl, "http://localhost").pathname).toBe("/api/v1/notifications/read-all");
    expect(allInit.method).toBe("PATCH");
  });

  it("reads and writes the preference array inside the documented body", async () => {
    const preferences: NotificationPreferenceInput[] = [
      { type: "ORDER_CONFIRMED", enabled: false },
      { type: "ORDER_CANCELLED", enabled: true },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(preferences))
      .mockResolvedValueOnce(jsonResponse(preferences));
    vi.stubGlobal("fetch", fetchMock);

    await expect(realNotificationsApi.getPreferences()).resolves.toEqual(preferences);
    await realNotificationsApi.updatePreferences(preferences);

    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(new URL(url, "http://localhost").pathname).toBe("/api/v1/notifications/preferences");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ preferences });
  });
});
