import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "../../../types/auth";
import OrdersList from "../OrdersList";

const mocks = vi.hoisted(() => {
  const mutation = () => ({ mutateAsync: vi.fn(), reset: vi.fn(), isPending: false, error: null });
  return {
    role: "CUSTOMER" as Role | null,
    useMyOrders: vi.fn(),
    useOrders: vi.fn(),
    cancelMy: mutation(),
    cancelStaff: mutation(),
    updateStatus: mutation(),
  };
});

vi.mock("../hooks", () => ({
  useMyOrders: mocks.useMyOrders,
  useOrders: mocks.useOrders,
  useCancelMyOrder: () => mocks.cancelMy,
  useCancelOrder: () => mocks.cancelStaff,
  useUpdateOrderStatus: () => mocks.updateStatus,
}));

vi.mock("../../../context/auth/useAuth", () => ({
  useAuth: () => ({ role: mocks.role }),
}));

const queryResult = (items: unknown[], total = items.length) => ({
  data: { items, total },
  isPending: false,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
});

const createdAt = "2026-01-01T10:00:00.000Z";

beforeEach(() => {
  mocks.role = "CUSTOMER";
  mocks.useMyOrders.mockReturnValue(queryResult([]));
  mocks.useOrders.mockReturnValue(queryResult([]));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("OrdersList", () => {
  it("customer scope uses /orders/mine data, hides search and the customer column", () => {
    mocks.role = "CUSTOMER";
    mocks.useMyOrders.mockReturnValue(
      queryResult([
        {
          id: 1,
          orderNumber: "ORD-0001",
          status: "PENDING",
          totalAmount: 49.98,
          createdAt,
          recipientName: "Cara Customer",
        },
      ]),
    );

    render(
      <MemoryRouter>
        <OrdersList scope="my" />
      </MemoryRouter>,
    );

    expect(screen.getByText("#ORD-0001")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Pending")).toBeInTheDocument();
    expect(screen.queryByLabelText("Search orders")).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Customer" })).toBeNull();
    expect(screen.queryByText("Cara Customer")).toBeNull();
  });

  it("staff scope shows staff filters and STAFF gets confirm + cancel on PENDING", () => {
    mocks.role = "STAFF";
    mocks.useOrders.mockReturnValue(
      queryResult([
        {
          id: 1,
          orderNumber: "ORD-0001",
          status: "PENDING",
          totalAmount: 49.98,
          createdAt,
          customerName: "Ahmed Mohamed",
        },
      ]),
    );

    render(
      <MemoryRouter>
        <OrdersList scope="staff" />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Search orders")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Customer" })).toBeInTheDocument();
    expect(screen.getByText("Ahmed Mohamed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Actions for #ORD-0001" }));

    expect(screen.getByRole("menuitem", { name: "Confirm order" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Cancel order" })).toBeInTheDocument();
  });

  it("SUPPORT never gets a confirm action", () => {
    mocks.role = "SUPPORT";
    mocks.useOrders.mockReturnValue(
      queryResult([
        {
          id: 1,
          orderNumber: "ORD-0001",
          status: "PENDING",
          totalAmount: 49.98,
          createdAt,
          customerName: "Ahmed Mohamed",
        },
      ]),
    );

    render(
      <MemoryRouter>
        <OrdersList scope="staff" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Actions for #ORD-0001" }));

    expect(screen.queryByRole("menuitem", { name: "Confirm order" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Cancel order" })).toBeInTheDocument();
  });
});
