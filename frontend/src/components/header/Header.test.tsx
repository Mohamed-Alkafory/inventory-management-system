import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tokenStorage } from "../../api/tokenStorage";
import AuthProvider from "../../context/auth/AuthProvider";
import CartProvider from "../../context/cart/CartProvider";
import FavoritesProvider from "../../context/favorites/FavoritesProvider";
import type { InventoryProduct } from "../../types/inventory";
import Header from "./Header";

vi.mock("../../api/authApi", () => ({
  authApi: { login: vi.fn(), logout: vi.fn().mockResolvedValue(undefined), me: vi.fn().mockImplementation(() => new Promise(() => {})) },
}));

vi.mock("../../api/productsApi", () => ({
  productsApi: { list: vi.fn(), categories: vi.fn().mockResolvedValue([]) },
}));

function renderHeader() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AuthProvider>
          <CartProvider>
            <FavoritesProvider>
              <Header />
            </FavoritesProvider>
          </CartProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const cartProduct = (id: string): InventoryProduct => ({
  id,
  name: `Product ${id}`,
  sku: `SKU-${id}`,
  categoryId: "c1",
  category: "Accessories",
  price: 450,
  stock: 10,
  reorderLevel: 0,
  status: "in_stock",
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("Header mobile menu", () => {
  it("exposes a toggle that opens and closes the nav", () => {
    renderHeader();

    const toggle = screen.getByRole("button", { name: /open menu/i });
    const nav = document.getElementById("main-nav")!;

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(nav.className).not.toContain("is-open");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(nav.className).toContain("is-open");
    expect(screen.getByRole("button", { name: /close menu/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /close menu/i }));
    expect(nav.className).not.toContain("is-open");
  });

  it("keeps the user's name out of the header and counts the cart as a badge", () => {
    tokenStorage.setSession({
      accessToken: "t",
      refreshToken: "r",
      user: { id: "1", name: "Test User", email: "test@prodexa.com", role: "STAFF" },
    });
    localStorage.setItem(
      "prodexa.cart.v1",
      JSON.stringify([{ product: cartProduct("1"), quantity: 3 }]),
    );
    renderHeader();

    // Signed-in: no name anywhere in the header…
    expect(screen.queryByText("Test User")).not.toBeInTheDocument();
    // …only Log out + the profile icon.
    expect(screen.getAllByRole("button", { name: /log out/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /your profile/i }).length).toBeGreaterThan(0);
    // Cart count badge.
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
