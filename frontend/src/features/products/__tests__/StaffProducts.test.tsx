import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StaffProducts from "../StaffProducts";
import StaffProductDetails from "../StaffProductDetails";

const mocks = vi.hoisted(() => ({
  useProducts: vi.fn(),
  useProduct: vi.fn(),
  useProductCategories: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../../../hooks/useProducts", () => ({
  useProducts: mocks.useProducts,
  useProduct: mocks.useProduct,
  useProductCategories: mocks.useProductCategories,
}));

vi.mock("../../../page/Products/useProductFilters", () => ({
  useProductFilters: () => ({
    query: { search: "", category: "", status: "", sortBy: null, sortDir: "asc", page: 1, pageSize: 10 },
    update: mocks.update,
    clearFilters: vi.fn(),
    hasFilters: false,
  }),
}));

const product = {
  id: "p-1",
  name: "Water Bottle",
  sku: "SKU-1",
  categoryId: "c-1",
  category: "Kitchen",
  price: 19.99,
  costPrice: 8,
  stock: 12,
  reorderLevel: 5,
  status: "in_stock" as const,
};

beforeEach(() => {
  mocks.useProducts.mockReturnValue({
    data: { items: [product], total: 1 },
    isPending: false,
    isError: false,
    isPlaceholderData: false,
    refetch: vi.fn(),
  });
  mocks.useProduct.mockReturnValue({ data: product, isPending: false, isError: false, refetch: vi.fn() });
  mocks.useProductCategories.mockReturnValue({ data: [], isPending: false, isError: false });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StaffProducts", () => {
  it("lists products read-only, without cost price or write controls", () => {
    render(
      <MemoryRouter>
        <StaffProducts />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Products" })).toBeInTheDocument();
    expect(screen.getByText("Water Bottle")).toBeInTheDocument();
    expect(screen.getByText("SKU-1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View/i })).toHaveAttribute("href", "/staff/products/p-1");

    expect(screen.queryByText(/cost/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /add product|new product/i })).toBeNull();
  });
});

describe("StaffProductDetails", () => {
  it("shows the private product without cost price or edit/delete actions", () => {
    render(
      <MemoryRouter initialEntries={["/staff/products/p-1"]}>
        <Routes>
          <Route path="/staff/products/:id" element={<StaffProductDetails />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Water Bottle" })).toBeInTheDocument();
    expect(screen.getByText(/SKU-1/)).toBeInTheDocument();

    expect(screen.queryByText(/cost/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });
});
