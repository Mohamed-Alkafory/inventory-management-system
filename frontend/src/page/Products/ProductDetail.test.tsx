import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ToastProvider from "../../components/ui/toast/ToastProvider";
import AuthProvider from "../../context/auth/AuthProvider";
import CartProvider from "../../context/cart/CartProvider";
import FavoritesProvider from "../../context/favorites/FavoritesProvider";
import type { InventoryProduct } from "../../types/inventory";
import ProductDetail from "./ProductDetail";

const list = vi.hoisted(() => vi.fn());
const get = vi.hoisted(() => vi.fn());

vi.mock("../../api/authApi", () => ({
  authApi: { login: vi.fn(), logout: vi.fn().mockResolvedValue(undefined), me: vi.fn().mockImplementation(() => new Promise(() => {})) },
}));
vi.mock("../../api/productsApi", () => ({
  productsApi: { list, get, categories: vi.fn().mockResolvedValue([{ id: "c1", name: "Accessories" }]) },
}));

const product = (): InventoryProduct => ({
  id: "p-1",
  name: "Mechanical Keyboard",
  sku: "KB-310",
  categoryId: "c1",
  category: "Accessories",
  description: "Tactile switches with per-key RGB lighting.",
  price: 1850,
  stock: 36,
  reorderLevel: 15,
  status: "in_stock",
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/products/p-1"]}>
          <AuthProvider>
            <CartProvider>
              <FavoritesProvider>
                <ProductDetail />
              </FavoritesProvider>
            </CartProvider>
          </AuthProvider>
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

describe("Product detail page", () => {
  it("renders the big picture info: name, description, price and status", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Mechanical Keyboard" })).toBeInTheDocument();
    expect(screen.getByText("Tactile switches with per-key RGB lighting.")).toBeInTheDocument();
    expect(screen.getByText("1,850 EGP")).toBeInTheDocument();
    expect(screen.getByText(/36 in stock/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to cart/i })).toBeInTheDocument();
  });

  it("adds the picked quantity to the cart", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Mechanical Keyboard" });

    fireEvent.click(screen.getByRole("button", { name: /increase quantity/i }));
    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));

    expect(await screen.findByText(/added to cart/i)).toBeInTheDocument();
  });

  it("hearts and un-hearts the product", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Mechanical Keyboard" });

    fireEvent.click(screen.getByRole("button", { name: "Add to favorites" }));
    expect(await screen.findByRole("button", { name: "Remove from favorites" })).toBeInTheDocument();
  });
});
