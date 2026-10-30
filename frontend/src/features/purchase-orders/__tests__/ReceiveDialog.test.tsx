import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ToastProvider from "../../../components/ui/toast/ToastProvider";
import ReceiveDialog from "../ReceiveDialog";

const mocks = vi.hoisted(() => ({
  usePurchaseOrder: vi.fn(),
  receive: { mutateAsync: vi.fn(), isPending: false },
}));

vi.mock("../hooks", () => ({
  usePurchaseOrder: mocks.usePurchaseOrder,
  useReceivePo: () => mocks.receive,
}));

const orderedPo = {
  id: "po-1",
  number: "PO-0001",
  supplierId: "s-1",
  supplierName: "Acme Supplies",
  status: "partially_received",
  total: 100,
  expectedAt: null,
  receivedAt: null,
  createdAt: "2026-01-01T10:00:00.000Z",
  notes: null,
  lines: [
    { productId: "p-1", name: "Water Bottle", sku: "SKU-1", quantityOrdered: 10, quantityReceived: 4, unitCost: 10 },
  ],
};

beforeEach(() => {
  mocks.usePurchaseOrder.mockReturnValue({ data: orderedPo, isPending: false, isError: false, refetch: vi.fn() });
  mocks.receive.mutateAsync.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ReceiveDialog remaining limits", () => {
  it("caps each line at the remaining quantity and never submits more", async () => {
    render(
      <ToastProvider>
        <ReceiveDialog poId="po-1" onClose={vi.fn()} />
      </ToastProvider>,
    );

    const input = screen.getByLabelText("Quantity to receive for Water Bottle") as HTMLInputElement;
    expect(input).toHaveAttribute("max", "6");
    expect(input).toHaveValue(0);

    // "All remaining" fills exactly what is still missing (10 ordered − 4 received).
    fireEvent.click(screen.getByRole("button", { name: "Receive all remaining" }));
    expect(input).toHaveValue(6);

    fireEvent.click(screen.getByRole("button", { name: "Receive 1" }));
    await waitFor(() =>
      expect(mocks.receive.mutateAsync).toHaveBeenCalledWith({
        id: "po-1",
        items: [{ productId: "p-1", quantity: 6 }],
      }),
    );
  });

  it("disables receiving once every line is fully received", () => {
    mocks.usePurchaseOrder.mockReturnValue({
      data: { ...orderedPo, status: "received", lines: [{ ...orderedPo.lines[0], quantityReceived: 10 }] },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(
      <ToastProvider>
        <ReceiveDialog poId="po-1" onClose={vi.fn()} />
      </ToastProvider>,
    );

    expect(screen.getByText("Everything ordered has been received.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Receive all remaining" })).toBeDisabled();
    expect(screen.getByLabelText("Quantity to receive for Water Bottle")).toBeDisabled();
  });
});
