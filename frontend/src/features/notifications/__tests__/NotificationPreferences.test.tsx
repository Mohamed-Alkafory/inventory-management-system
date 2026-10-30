import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "../../../types/auth";
import type { NotificationPreference } from "../types";
import NotificationPreferences from "../NotificationPreferences";

const state = vi.hoisted(() => ({
  role: "CUSTOMER" as Role,
  data: [] as NotificationPreference[],
  save: vi.fn(),
  saveError: null as Error | null,
}));

vi.mock("../../../context/auth/useAuth", () => ({
  useAuth: () => ({ role: state.role }),
}));

vi.mock("../hooks", () => ({
  useNotificationPreferences: () => ({
    data: state.data,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useUpdateNotificationPreferences: () => ({
    mutate: state.save,
    isPending: false,
    isSuccess: false,
    isError: Boolean(state.saveError),
    error: state.saveError,
  }),
}));

const allPreferences: NotificationPreference[] = [
  { type: "LOW_STOCK", enabled: true },
  { type: "ORDER_CREATED", enabled: true },
  { type: "ORDER_CONFIRMED", enabled: true },
  { type: "ORDER_CANCELLED", enabled: true },
  { type: "PURCHASE_ORDER_RECEIVED", enabled: true },
  { type: "CONTACT_MESSAGE_RECEIVED", enabled: true },
  { type: "SYSTEM", enabled: true },
];

beforeEach(() => {
  state.role = "CUSTOMER";
  state.data = allPreferences;
  state.save.mockReset();
  state.saveError = null;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("NotificationPreferences", () => {
  it("shows only the customer's applicable types", () => {
    render(<NotificationPreferences />);

    expect(screen.getByRole("switch", { name: "Order confirmed" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Order cancelled" })).toBeChecked();
    expect(screen.queryByRole("switch", { name: "Low stock" })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Contact message" })).not.toBeInTheDocument();
  });

  it("saves the toggled role-relevant preferences", () => {
    render(<NotificationPreferences />);

    fireEvent.click(screen.getByRole("switch", { name: "Order confirmed" }));
    const save = screen.getByRole("button", { name: "Save preferences" });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    expect(state.save).toHaveBeenCalledWith([
      { type: "ORDER_CONFIRMED", enabled: false },
      { type: "ORDER_CANCELLED", enabled: true },
    ]);
  });

  it("shows only the staff type and disables saving until something changes", () => {
    state.role = "STAFF";
    render(<NotificationPreferences />);

    expect(screen.getByRole("switch", { name: "New order" })).toBeChecked();
    expect(screen.queryByRole("switch", { name: "Order confirmed" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save preferences" })).toBeDisabled();
  });

  it("surfaces a save error", () => {
    state.saveError = new Error("Couldn't save notification preferences.");
    render(<NotificationPreferences />);

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save notification preferences.");
  });
});
