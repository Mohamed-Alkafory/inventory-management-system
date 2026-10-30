import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { daysIn } from "../../../lib/dateRange";
import { ApiError } from "../../../lib/http";
import DashboardView from "../DashboardView";

const mocks = vi.hoisted(() => ({
  useDashboardSummary: vi.fn(),
  useDashboardSales: vi.fn(),
  useDashboardTopProducts: vi.fn(),
  useDashboardStockMovements: vi.fn(),
  useDashboardLowStock: vi.fn(),
}));

vi.mock("../hooks", () => ({
  useDashboardSummary: mocks.useDashboardSummary,
  useDashboardSales: mocks.useDashboardSales,
  useDashboardTopProducts: mocks.useDashboardTopProducts,
  useDashboardStockMovements: mocks.useDashboardStockMovements,
  useDashboardLowStock: mocks.useDashboardLowStock,
}));

const query = (data: unknown) => ({
  data,
  isPending: false,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
  error: null,
});

const summary = {
  totalProducts: 42,
  totalStockUnits: 1_364,
  stockValue: 1_248_500,
  lowStockCount: 4,
  outOfStockCount: 3,
  ordersInPeriod: 18,
  revenueInPeriod: 9_876.5,
  period: { from: "2026-10-01", to: "2026-10-30" },
};

const sales = [
  { date: "2026-10-01", totalSales: 120, orderCount: 2 },
  { date: "2026-10-02", totalSales: 340, orderCount: 3 },
];

const movements = [{ date: "2026-10-01", unitsIn: 10, unitsOut: 4 }];

const topProducts = [
  { productId: "p-1", productName: "Wireless Mouse", sku: "WM-204", quantitySold: 96, revenue: 43_200 },
];

const lowStock = {
  items: [
    {
      id: "p-2",
      name: "USB-C Charging Cable",
      sku: "UC-110",
      categoryId: "c-1",
      category: "Accessories",
      price: 120,
      stock: 9,
      reorderLevel: 25,
      status: "low_stock" as const,
    },
  ],
  total: 1,
};

function setData() {
  mocks.useDashboardSummary.mockReturnValue(query(summary));
  mocks.useDashboardSales.mockReturnValue(query(sales));
  mocks.useDashboardTopProducts.mockReturnValue(query(topProducts));
  mocks.useDashboardStockMovements.mockReturnValue(query(movements));
  mocks.useDashboardLowStock.mockReturnValue(query(lowStock));
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <DashboardView />
    </MemoryRouter>,
  );
}

beforeEach(setData);
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DashboardView", () => {
  it("renders the summary, charts, top products and low-stock table from the API data", () => {
    renderDashboard();

    expect(screen.getByText("Revenue in period")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/9,876/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Daily sales chart" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Stock movements chart/ })).toBeInTheDocument();
    expect(screen.getByText("Wireless Mouse")).toBeInTheDocument();
    expect(screen.getByText("USB-C Charging Cable")).toBeInTheDocument();
  });

  it("renders zero values and empty states without breaking when the period has no data", () => {
    mocks.useDashboardSales.mockReturnValue(query([{ date: "2026-10-01", totalSales: 0, orderCount: 0 }]));
    mocks.useDashboardStockMovements.mockReturnValue(query([{ date: "2026-10-01", unitsIn: 0, unitsOut: 0 }]));
    mocks.useDashboardTopProducts.mockReturnValue(query([]));
    mocks.useDashboardLowStock.mockReturnValue(query({ items: [], total: 0 }));

    renderDashboard();

    expect(screen.getByText("No sales in this period.")).toBeInTheDocument();
    expect(screen.getByText("No stock movements in this period.")).toBeInTheDocument();
    expect(screen.getByText("No products sold")).toBeInTheDocument();
    expect(screen.getByText("All stocked up")).toBeInTheDocument();
    expect(screen.getAllByText(/EGP 0/).length).toBeGreaterThan(0);
  });

  it("shows the widget error state and the server's range validation message", () => {
    const message = "Date range must not exceed 92 days";
    mocks.useDashboardSummary.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      isFetching: false,
      refetch: vi.fn(),
      error: new ApiError(400, message, { serverMessage: message }),
    });

    renderDashboard();

    expect(screen.getByText("Couldn't load the dashboard summary")).toBeInTheDocument();
    expect(screen.getByText("Try again")).toBeInTheDocument();
    expect(screen.getAllByText(message).length).toBeGreaterThan(0);
  });

  it("refetches every widget with the new range when a preset is chosen", async () => {
    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: /Date range:/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Last 7 days" }));

    await waitFor(() => {
      const range = mocks.useDashboardSales.mock.calls.at(-1)?.[0];
      expect(range).toBeDefined();
      expect(daysIn(range)).toBe(7);
    });
    expect(mocks.useDashboardSummary.mock.calls.at(-1)?.[0]).toMatchObject(
      mocks.useDashboardSales.mock.calls.at(-1)?.[0],
    );
  });
});
