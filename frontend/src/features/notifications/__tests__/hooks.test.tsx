import "@testing-library/jest-dom/vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  notificationKeys,
  UNREAD_POLL_MS,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useUnreadCount,
} from "../hooks";
import type { NotificationItem, NotificationPage } from "../types";

const api = vi.hoisted(() => ({
  unreadCount: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
}));

vi.mock("../api", () => ({ notificationsApi: api }));

const client = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: Infinity }, mutations: { retry: false } },
  });

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const setVisibility = (value: "visible" | "hidden") => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
};

const item = (overrides: Partial<NotificationItem> = {}): NotificationItem => ({
  id: "n-1",
  type: "ORDER_CONFIRMED",
  title: "Order confirmed",
  message: "Order ORD-1 is now CONFIRMED.",
  entityType: "order",
  entityId: "o-1",
  isRead: false,
  readAt: null,
  createdAt: "2026-10-30T10:00:00.000Z",
  ...overrides,
});

const params = { page: 1, pageSize: 10 };

beforeEach(() => {
  setVisibility("visible");
  api.unreadCount.mockReset().mockResolvedValue(3);
  api.markRead.mockReset();
  api.markAllRead.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("useUnreadCount", () => {
  it("polls every interval only while the tab is visible", async () => {
    vi.useFakeTimers();
    const queryClient = client();
    renderHook(() => useUnreadCount(true), { wrapper: wrapperFor(queryClient) });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(api.unreadCount).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNREAD_POLL_MS + 10);
    });
    expect(api.unreadCount).toHaveBeenCalledTimes(2);

    await act(async () => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNREAD_POLL_MS * 3);
    });
    expect(api.unreadCount).toHaveBeenCalledTimes(2);

    await act(async () => {
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNREAD_POLL_MS + 10);
    });
    expect(api.unreadCount).toHaveBeenCalledTimes(3);
  });

  it("does not fetch at all while signed out", async () => {
    vi.useFakeTimers();
    const queryClient = client();
    renderHook(() => useUnreadCount(false), { wrapper: wrapperFor(queryClient) });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNREAD_POLL_MS * 3);
    });
    expect(api.unreadCount).not.toHaveBeenCalled();
  });
});

describe("mark-read cache updates", () => {
  it("updates the cached row and decrements the unread badge", async () => {
    const queryClient = client();
    const page: NotificationPage = {
      items: [item(), item({ id: "n-2", isRead: true })],
      page: 1,
      pageSize: 10,
      total: 2,
      totalPages: 1,
    };
    queryClient.setQueryData(notificationKeys.list(params), page);
    queryClient.setQueryData(notificationKeys.unread, { count: 1 });

    api.markRead.mockResolvedValue(item({ isRead: true, readAt: "2026-10-30T11:00:00.000Z" }));

    const { result } = renderHook(() => useMarkNotificationRead(), { wrapper: wrapperFor(queryClient) });
    await act(async () => {
      await result.current.mutateAsync("n-1");
    });

    const updated = queryClient.getQueryData<NotificationPage>(notificationKeys.list(params));
    expect(updated?.items.find((n) => n.id === "n-1")?.isRead).toBe(true);
    expect(queryClient.getQueryData(notificationKeys.unread)).toEqual({ count: 0 });
  });

  it("marks every cached row read and resets the badge on mark-all", async () => {
    const queryClient = client();
    const page: NotificationPage = {
      items: [item(), item({ id: "n-2" })],
      page: 1,
      pageSize: 10,
      total: 2,
      totalPages: 1,
    };
    queryClient.setQueryData(notificationKeys.list(params), page);
    queryClient.setQueryData(notificationKeys.unread, { count: 2 });
    api.markAllRead.mockResolvedValue(2);

    const { result } = renderHook(() => useMarkAllNotificationsRead(), { wrapper: wrapperFor(queryClient) });
    await act(async () => {
      await result.current.mutateAsync();
    });

    const updated = queryClient.getQueryData<NotificationPage>(notificationKeys.list(params));
    expect(updated?.items.every((n) => n.isRead)).toBe(true);
    expect(queryClient.getQueryData(notificationKeys.unread)).toEqual({ count: 0 });
  });
});
