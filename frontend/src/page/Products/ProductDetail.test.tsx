import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/http";
import ToastProvider from "../../components/ui/toast/ToastProvider";
import CartProvider from "../../context/cart/CartProvider";
import FavoritesProvider from "../../context/favorites/FavoritesProvider";
import type { ShopProduct } from "../../types/shop";
import ProductDetail from "./ProductDetail";

const get = vi.hoisted(() => vi.fn());

vi.mock("../../api/catalogApi", () => ({
  catalogApi: { get, list: vi.fn(), categories: vi.fn().mockResolvedValue([]) },
}));

const product = (over: Partial<ShopProduct> = {}): ShopProduct => ({
  id: "p-1",
  name: "Mechanical Keyboard",
  description: "Tactile switches with per-key RGB lighting.",
  price: 1850,
  category: "Accessories",
  categoryId: "c1",
  inStock: true,
  maxOrderable: 3,
  ...over,
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/products/p-1"]}>
          <CartProvider>
            <FavoritesProvider>
              <Routes>
                <Route path="/products/:id" element={<ProductDetail />} />
                <Route path="/products" element={<p>All products page</p>} />
              </Routes>
            </FavoritesProvider>
          </CartProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  get.mockReset();
  get.mockResolvedValue(product());
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("product detail page", () => {
  it("renders customer-safe info only: name, description, price and availability", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Mechanical Keyboard" })).toBeInTheDocument();
    expect(screen.getByText("Tactile switches with per-key RGB lighting.")).toBeInTheDocument();
    expect(screen.getByText("1,850 EGP")).toBeInTheDocument();
    expect(screen.getByText("In stock")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to cart/i })).toBeInTheDocument();
    expect(screen.queryByText(/sku/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/36 in stock/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cost price/i)).not.toBeInTheDocument();
  });

  it("caps the quantity at maxOrderable", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Mechanical Keyboard" });

    const plus = screen.getByRole("button", { name: /increase quantity/i });
    fireEvent.click(plus);
    fireEvent.click(plus);
    expect(plus).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));

    const stored = JSON.parse(localStorage.getItem("prodexa.cart.v1") ?? "[]");
    expect(stored[0].quantity).toBe(3);
    expect(stored[0].product).toMatchObject({ id: "p-1", name: "Mechanical Keyboard", maxOrderable: 3 });
    expect(stored[0].product).not.toHaveProperty("sku");
    expect(stored[0].product).not.toHaveProperty("costPrice");
    expect(stored[0].product).not.toHaveProperty("stock");
  });

  it("disables add-to-cart when the product is out of stock", async () => {
    get.mockResolvedValue(product({ inStock: false, maxOrderable: 0 }));
    renderPage();

    expect(await screen.findByRole("heading", { name: "Mechanical Keyboard" })).toBeInTheDocument();
    expect(screen.getAllByText("Out of stock").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /out of stock/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /increase quantity/i })).toBeDisabled();
  });

  it("shows a not-found state for an inactive/unknown product (404)", async () => {
    get.mockRejectedValue(new ApiError(404, "We couldn't find what you were looking for."));
    renderPage();

    expect(await screen.findByText("Product not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /all products/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
  });

  it("surfaces the rate limit message (429)", async () => {
    get.mockRejectedValue(new ApiError(429, "Too many requests. Please slow down and try again."));
    renderPage();

    expect(await screen.findByText(/try again in a moment/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("hearts and un-hearts the product", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Mechanical Keyboard" });

    fireEvent.click(screen.getByRole("button", { name: "Add to favorites" }));
    expect(await screen.findByRole("button", { name: "Remove from favorites" })).toBeInTheDocument();
  });
});
