import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "../../../types/auth";
import { ApiError } from "../../../lib/http";
import OrderDetailsView from "../OrderDetailsView";

const mocks = vi.hoisted(() => {
  const mutation = () => ({ mutateAsync: vi.fn(), reset: vi.fn(), isPending: false, error: null });
  return {
    role: "CUSTOMER" as Role | null,
    useMyOrder: vi.fn(),
    useOrder: vi.fn(),
    cancelMy: mutation(),
    cancelStaff: mutation(),
    updateStatus: mutation(),
  };
});

vi.mock("../hooks", () => ({
  useMyOrder: mocks.useMyOrder,
  useOrder: mocks.useOrder,
  useCancelMyOrder: () => mocks.cancelMy,
  useCancelOrder: () => mocks.cancelStaff,
  useUpdateOrderStatus: () => mocks.updateStatus,
}));

vi.mock("../../../context/auth/useAuth", () => ({
  useAuth: () => ({ role: mocks.role }),
}));

const queryResult = (data: unknown) => ({
  data,
  isPending: false,
  isError: false,
  refetch: vi.fn(),
});

const customerOrder = (status = "PENDING") => ({
  id: 1,
  orderNumber: "ORD-0001",
  status,
  totalAmount: 49.98,
  items: [{ productName: "Water Bottle", sku: "SKU-1", quantity: 2, unitPrice: 19.99, lineTotal: 39.98 }],
  recipientName: "Cara Customer",
  shippingAddress: "1 Nile Street",
  shippingCity: "Cairo",
  paymentMethod: "COD",
  createdAt: "2026-01-01T10:00:00.000Z",
});

const staffOrder = (status = "CONFIRMED") => ({
  ...customerOrder(status),
  customerName: "Ahmed Mohamed",
  customerPhone: "+20 100 000 0000",
  notes: "Call before delivery",
  createdBy: { id: "u-2", name: "Sami Staff", email: "staff@prodexa.com" },
});

beforeEach(() => {
  mocks.role = "CUSTOMER";
  mocks.useMyOrder.mockReturnValue(queryResult(undefined));
  mocks.useOrder.mockReturnValue(queryResult(undefined));
  mocks.cancelMy.mutateAsync.mockResolvedValue(undefined);
  mocks.cancelStaff.mutateAsync.mockResolvedValue(undefined);
  mocks.updateStatus.mutateAsync.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("OrderDetailsView", () => {
  it("customer scope shows only the customer action and safe personal data", () => {
    mocks.role = "CUSTOMER";
    mocks.useMyOrder.mockReturnValue(queryResult(customerOrder("PENDING")));

    render(
      <MemoryRouter>
        <OrderDetailsView id="1" scope="my" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Order #ORD-0001" })).toBeInTheDocument();
    expect(screen.getByText("Cara Customer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel order" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm order" })).toBeNull();
    // Missing customer phone / notes are never rendered as empty rows.
    expect(screen.queryByText("Customer phone")).toBeNull();
    expect(screen.queryByText("Notes")).toBeNull();
  });

  it("staff scope on a CONFIRMED order offers cancel (not confirm) and shows staff fields", () => {
    mocks.role = "STAFF";
    mocks.useOrder.mockReturnValue(queryResult(staffOrder("CONFIRMED")));

    render(
      <MemoryRouter>
        <OrderDetailsView id="1" scope="staff" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Ahmed Mohamed")).toBeInTheDocument();
    expect(screen.getByText("+20 100 000 0000")).toBeInTheDocument();
    expect(screen.getByText("Call before delivery")).toBeInTheDocument();
    expect(screen.getByText("Sami Staff")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel order" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm order" })).toBeNull();
  });

  it("SUPPORT on a PENDING order may cancel but never confirm", () => {
    mocks.role = "SUPPORT";
    mocks.useOrder.mockReturnValue(queryResult(staffOrder("PENDING")));

    render(
      <MemoryRouter>
        <OrderDetailsView id="1" scope="staff" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Cancel order" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm order" })).toBeNull();
  });

  it("shows no actions on a terminal CANCELLED order", () => {
    mocks.role = "ADMIN";
    mocks.useOrder.mockReturnValue(queryResult(staffOrder("CANCELLED")));

    render(
      <MemoryRouter>
        <OrderDetailsView id="1" scope="staff" />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "Cancel order" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Confirm order" })).toBeNull();
  });

  it("cancels an own PENDING order only after confirmation", async () => {
    mocks.role = "CUSTOMER";
    mocks.useMyOrder.mockReturnValue(queryResult(customerOrder("PENDING")));

    render(
      <MemoryRouter>
        <OrderDetailsView id="1" scope="my" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/cancel this order/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel order" }));

    await waitFor(() => expect(mocks.cancelMy.mutateAsync).toHaveBeenCalledWith(1));
  });

  it("shows a not-found state for a 404 and renders no order data", () => {
    mocks.useMyOrder.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new ApiError(404, "Order not found"),
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <OrderDetailsView id="missing" scope="my" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Order not found");
    expect(screen.queryByText("Cara Customer")).toBeNull();
    expect(screen.queryByText("Water Bottle")).toBeNull();
  });
});
