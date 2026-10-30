import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "../../../types/auth";
import type { NotificationItem } from "../types";
import NotificationBell from "../NotificationBell";

const state = vi.hoisted(() => ({
  role: "STAFF" as Role,
  isAuthenticated: true,
  count: 3,
  items: [] as NotificationItem[],
  markRead: vi.fn(),
  markAll: vi.fn(),
}));

vi.mock("../../../context/auth/useAuth", () => ({
  useAuth: () => ({ role: state.role, isAuthenticated: state.isAuthenticated }),
}));

vi.mock("../hooks", () => ({
  useUnreadCount: () => ({ data: state.count }),
  useNotifications: () => ({
    data: { items: state.items, page: 1, pageSize: 6, total: state.items.length, totalPages: 1 },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useMarkNotificationRead: () => ({ mutateAsync: state.markRead, isPending: false, isError: false }),
  useMarkAllNotificationsRead: () => ({ mutate: state.markAll, isPending: false, isError: false }),
}));

const item = (overrides: Partial<NotificationItem> = {}): NotificationItem => ({
  id: "n-1",
  type: "ORDER_CREATED",
  title: "New order",
  message: "Order ORD-1042 was created.",
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

function renderBell() {
  return render(
    <MemoryRouter>
      <NotificationBell />
      <LocationProbe />
    </MemoryRouter>,
  );
}

const trigger = () => screen.getByRole("button", { name: /^Notifications/ });

beforeEach(() => {
  state.role = "STAFF";
  state.isAuthenticated = true;
  state.count = 3;
  state.items = [
    item(),
    item({ id: "n-2", title: "Second order", message: "Order ORD-1038 was created.", isRead: true }),
  ];
  state.markRead.mockReset().mockResolvedValue(item({ isRead: true }));
  state.markAll.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("NotificationBell", () => {
  it("hides the badge at zero and caps it at 9+", () => {
    const view = renderBell();
    expect(screen.getByTestId("notification-badge")).toHaveTextContent("3");

    state.count = 12;
    view.rerender(
      <MemoryRouter>
        <NotificationBell />
        <LocationProbe />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("notification-badge")).toHaveTextContent("9+");

    state.count = 0;
    view.rerender(
      <MemoryRouter>
        <NotificationBell />
        <LocationProbe />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId("notification-badge")).not.toBeInTheDocument();
  });

  it("opens a dropdown with recent rows, mark-all and view-all", () => {
    renderBell();
    fireEvent.click(trigger());

    expect(screen.getByRole("menu", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByText("New order")).toBeInTheDocument();
    expect(screen.getByText("Order ORD-1042 was created.")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "View all" })).toHaveAttribute("href", "/notifications");

    fireEvent.click(screen.getByRole("menuitem", { name: /Mark all as read/ }));
    expect(state.markAll).toHaveBeenCalledTimes(1);
  });

  it("closes on outside click and Escape", () => {
    renderBell();
    fireEvent.click(trigger());
    expect(screen.getByRole("menu", { name: "Notifications" })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu", { name: "Notifications" })).not.toBeInTheDocument();

    fireEvent.click(trigger());
    fireEvent.keyDown(screen.getByRole("menu", { name: "Notifications" }), { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Notifications" })).not.toBeInTheDocument();
  });

  it("marks an item read then navigates to the role's order route", async () => {
    renderBell();
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("menuitem", { name: /New order/ }));

    await waitFor(() => expect(state.markRead).toHaveBeenCalledWith("n-1"));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/staff/orders/o-1"));
  });

  it("marks an item read and stays when the role has no route for the entity", async () => {
    state.role = "STAFF";
    state.items = [
      item({
        id: "n-3",
        type: "CONTACT_MESSAGE_RECEIVED",
        title: "Support message",
        entityType: "contact_message",
        entityId: "m-1",
      }),
    ];
    renderBell();
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("menuitem", { name: /Support message/ }));

    await waitFor(() => expect(state.markRead).toHaveBeenCalledWith("n-3"));
    expect(screen.getByTestId("location")).toHaveTextContent("/");
  });

  it("renders nothing for guests", () => {
    state.isAuthenticated = false;
    renderBell();
    expect(screen.queryByRole("button", { name: /^Notifications/ })).not.toBeInTheDocument();
  });
});
