import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SupportDashboard from "../SupportDashboard";

const mocks = vi.hoisted(() => ({
  useContactMessages: vi.fn(),
  useOrders: vi.fn(),
}));

vi.mock("../../../../features/contact/hooks", () => ({
  useContactMessages: mocks.useContactMessages,
}));

vi.mock("../../../../features/orders/hooks", () => ({
  useOrders: mocks.useOrders,
}));

const queryResult = (total: number) => ({
  data: { items: [], total },
  isPending: false,
  isError: false,
  refetch: vi.fn(),
});

beforeEach(() => {
  mocks.useContactMessages.mockReturnValue(queryResult(4));
  mocks.useOrders.mockReturnValue(queryResult(7));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SupportDashboard", () => {
  it("counts NEW messages and PENDING orders with limit 1", () => {
    render(
      <MemoryRouter>
        <SupportDashboard />
      </MemoryRouter>,
    );

    expect(mocks.useContactMessages).toHaveBeenCalledWith(
      expect.objectContaining({ status: "NEW", page: 1, pageSize: 1 }),
    );
    expect(mocks.useOrders).toHaveBeenCalledWith(
      expect.objectContaining({ status: "PENDING", page: 1, pageSize: 1 }),
    );

    expect(screen.getByText("New messages")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Pending orders")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("links both cards to the support pages", () => {
    render(
      <MemoryRouter>
        <SupportDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /New messages/ })).toHaveAttribute("href", "/support/messages");
    expect(screen.getByRole("link", { name: /Pending orders/ })).toHaveAttribute("href", "/support/orders");
  });
});
