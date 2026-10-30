import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "../../../types/auth";
import PurchaseOrderDetailsView from "../PurchaseOrderDetailsView";

const mocks = vi.hoisted(() => ({
  role: "ADMIN" as Role,
  usePurchaseOrder: vi.fn(),
  transition: { mutateAsync: vi.fn(), isPending: false },
  receive: { mutateAsync: vi.fn(), isPending: false },
}));

vi.mock("../hooks", () => ({
  usePurchaseOrder: mocks.usePurchaseOrder,
  usePoTransition: () => mocks.transition,
  useReceivePo: () => mocks.receive,
}));

vi.mock("../../../context/auth/useAuth", () => ({
  useAuth: () => ({ role: mocks.role }),
}));

const po = (status: "draft" | "ordered" | "partially_received") => ({
  id: "po-1",
  number: "PO-0001",
  supplierId: "s-1",
  supplierName: "Acme Supplies",
  status,
  total: 100,
  expectedAt: "2026-02-01T00:00:00.000Z",
  receivedAt: null,
  createdAt: "2026-01-01T10:00:00.000Z",
  notes: null,
  lines: [
    {
      productId: "p-1",
      name: "Water Bottle",
      sku: "SKU-1",
      quantityOrdered: 10,
      quantityReceived: status === "partially_received" ? 4 : 0,
      unitCost: 10,
    },
  ],
});

beforeEach(() => {
  mocks.role = "ADMIN";
  mocks.usePurchaseOrder.mockReturnValue({ data: po("ordered"), isPending: false, isError: false, refetch: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("purchase-order actions by role", () => {
  it("ADMIN keeps the full lifecycle (place/cancel) and may receive", () => {
    mocks.usePurchaseOrder.mockReturnValue({ data: po("draft"), isPending: false, isError: false, refetch: vi.fn() });
    render(
      <MemoryRouter>
        <PurchaseOrderDetailsView id="po-1" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Place order" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Receive stock/i })).toBeNull();
  });

  it("STAFF sees receive only on an ordered PO", () => {
    mocks.role = "STAFF";
    mocks.usePurchaseOrder.mockReturnValue({ data: po("ordered"), isPending: false, isError: false, refetch: vi.fn() });
    render(
      <MemoryRouter>
        <PurchaseOrderDetailsView id="po-1" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /Receive stock/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Place order" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("STAFF sees no status actions on a draft PO", () => {
    mocks.role = "STAFF";
    mocks.usePurchaseOrder.mockReturnValue({ data: po("draft"), isPending: false, isError: false, refetch: vi.fn() });
    render(
      <MemoryRouter>
        <PurchaseOrderDetailsView id="po-1" />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "Place order" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Receive stock/i })).toBeNull();
  });
});
