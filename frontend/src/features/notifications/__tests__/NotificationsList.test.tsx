import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "../../../types/auth";
import type { NotificationItem, NotificationListParams } from "../types";
import NotificationsList from "../NotificationsList";

const state = vi.hoisted(() => ({
  role: "CUSTOMER" as Role,
  items: [] as NotificationItem[],
  total: 0,
  totalPages: 0,
  unread: 0,
  markRead: vi.fn(),
  markReadAsync: vi.fn(),
  markAll: vi.fn(),
  calls: [] as NotificationListParams[],
}));

vi.mock("../../../context/auth/useAuth", () => ({
  useAuth: () => ({ role: state.role }),
}));

vi.mock("../hooks", () => ({
  useNotifications: (params: NotificationListParams) => {
    state.calls.push(params);
    return {
      data: { items: state.items, page: params.page, pageSize: params.pageSize, total: state.total, totalPages: state.totalPages },
      isPending: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    };
  },
  useUnreadCount: () => ({ data: state.unread }),
  useMarkNotificationRead: () => ({
    mutate: state.markRead,
    mutateAsync: state.markReadAsync,
    isPending: false,
    isError: false,
    error: null,
  }),
  useMarkAllNotificationsRead: () => ({ mutate: state.markAll, isPending: false, isError: false, error: null }),
}));

const item = (overrides: Partial<NotificationItem> = {}): NotificationItem => ({
  id: "n-1",
  type: "ORDER_CONFIRMED",
  title: "Order confirmed",
  message: "Order ORD-1 is now CONFIRMED.",
  entityType: "order",
  entityId: "o-1",
  isRead: false,
  readAt: null,
  createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  ...overrides,
});

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}</p>;
}

function renderList() {
  return render(
    <MemoryRouter>
      <NotificationsList />
      <LocationProbe />
    </MemoryRouter>,
  );
}

const lastParams = () => state.calls.at(-1);

beforeEach(() => {
  state.role = "CUSTOMER";
  state.items = [item()];
  state.total = 1;
  state.totalPages = 1;
  state.unread = 1;
  state.markRead.mockReset();
  state.markReadAsync.mockReset().mockResolvedValue(item({ isRead: true }));
  state.markAll.mockReset();
  state.calls = [];
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("NotificationsList", () => {
  it("renders rows, applies the unread filter and paginates", () => {
    state.total = 25;
    state.totalPages = 3;
    renderList();

    expect(screen.getByRole("button", { name: "Order confirmed" })).toBeInTheDocument();
    expect(screen.getByText("Order ORD-1 is now CONFIRMED.")).toBeInTheDocument();
    expect(screen.getByText(/Showing 1–10 of 25/)).toBeInTheDocument();
    expect(lastParams()).toMatchObject({ page: 1, pageSize: 10 });

    fireEvent.click(screen.getByLabelText("Unread only"));
    expect(lastParams()).toMatchObject({ page: 1, unread: true });

    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(lastParams()).toMatchObject({ page: 2, unread: true });
  });

  it("marks a row read and stays when it has no target", async () => {
    state.items = [item({ id: "n-2", entityType: "SYSTEM", entityId: null })];
    renderList();

    fireEvent.click(screen.getByRole("button", { name: "Order confirmed" }));
    await waitFor(() => expect(state.markReadAsync).toHaveBeenCalledWith("n-2"));
    expect(screen.getByTestId("location")).toHaveTextContent("/");
  });

  it("marks the row read and navigates when opened", async () => {
    renderList();

    fireEvent.click(screen.getByRole("button", { name: "Order confirmed" }));

    await waitFor(() => expect(state.markReadAsync).toHaveBeenCalledWith("n-1"));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/orders/o-1"));
  });

  it("calls mark-all from the toolbar", () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: /Mark all as read/ }));
    expect(state.markAll).toHaveBeenCalledTimes(1);
  });
});
