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
    useOrderNotes: vi.fn(),
    addNote: mutation(),
  };
});

vi.mock("../hooks", () => ({
  useMyOrder: mocks.useMyOrder,
  useOrder: mocks.useOrder,
  useCancelMyOrder: () => mocks.cancelMy,
  useCancelOrder: () => mocks.cancelStaff,
  useUpdateOrderStatus: () => mocks.updateStatus,
  useOrderNotes: mocks.useOrderNotes,
  useAddOrderNote: () => mocks.addNote,
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
  mocks.useOrderNotes.mockReturnValue(queryResult([]));
  mocks.cancelMy.mutateAsync.mockResolvedValue(undefined);
  mocks.cancelStaff.mutateAsync.mockResolvedValue(undefined);
  mocks.updateStatus.mutateAsync.mockResolvedValue(undefined);
  mocks.addNote.mutateAsync.mockResolvedValue(undefined);
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

  it("SUPPORT cancels a PENDING order only after the confirmation dialog", async () => {
    mocks.role = "SUPPORT";
    mocks.useOrder.mockReturnValue(queryResult(staffOrder("PENDING")));

    render(
      <MemoryRouter>
        <OrderDetailsView id="1" scope="staff" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/cancel this order/i)).toBeInTheDocument();

    expect(mocks.cancelStaff.mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel order" }));
    await waitFor(() => expect(mocks.cancelStaff.mutateAsync).toHaveBeenCalledWith(1));
    expect(mocks.updateStatus.mutateAsync).not.toHaveBeenCalled();
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

  it("shows internal notes and the audit notice only in the staff scope", () => {
    mocks.role = "SUPPORT";
    mocks.useOrder.mockReturnValue(queryResult(staffOrder("PENDING")));
    mocks.useOrderNotes.mockReturnValue(
      queryResult([
        { id: "n-1", orderId: "1", note: "Courier called back", author: { id: "u-2", name: "Sami Staff" }, createdAt: "2026-01-02T09:00:00.000Z" },
      ]),
    );

    const view = render(
      <MemoryRouter>
        <OrderDetailsView id="1" scope="staff" />
      </MemoryRouter>,
    );

    const notes = screen.getByRole("heading", { name: "Internal notes" }).closest("section");
    expect(notes).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Internal notes" })).toBeInTheDocument();
    expect(screen.getByText("Courier called back")).toBeInTheDocument();
    expect(within(notes as HTMLElement).getByText("Sami Staff")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(/opening this order is recorded/i);
    view.unmount();

    mocks.role = "CUSTOMER";
    mocks.useMyOrder.mockReturnValue(queryResult(customerOrder("PENDING")));
    render(
      <MemoryRouter>
        <OrderDetailsView id="1" scope="my" />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("heading", { name: "Internal notes" })).toBeNull();
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.queryByText("Courier called back")).toBeNull();
  });

  it("lets SUPPORT add a note capped at 2000 characters", async () => {
    mocks.role = "SUPPORT";
    mocks.useOrder.mockReturnValue(queryResult(staffOrder("PENDING")));

    render(
      <MemoryRouter>
        <OrderDetailsView id="1" scope="staff" />
      </MemoryRouter>,
    );

    const input = screen.getByLabelText("Add a note");
    expect(input).toHaveAttribute("maxLength", "2000");
    fireEvent.change(input, { target: { value: "Please call the customer" } });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));

    await waitFor(() => expect(mocks.addNote.mutateAsync).toHaveBeenCalledWith("Please call the customer"));
  });
});
