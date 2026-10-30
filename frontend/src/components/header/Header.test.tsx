import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogApi } from "../../api/catalogApi";
import { productsApi } from "../../api/productsApi";
import { tokenStorage } from "../../api/tokenStorage";
import AuthProvider from "../../context/auth/AuthProvider";
import CartProvider from "../../context/cart/CartProvider";
import FavoritesProvider from "../../context/favorites/FavoritesProvider";
import type { Role } from "../../types/auth";
import type { ShopProduct } from "../../types/shop";
import Header from "./Header";

vi.mock("../../api/authApi", () => ({
  authApi: { login: vi.fn(), logout: vi.fn().mockResolvedValue(undefined), me: vi.fn().mockImplementation(() => new Promise(() => {})) },
}));

vi.mock("../../api/productsApi", () => ({
  productsApi: { list: vi.fn(), get: vi.fn(), categories: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../api/catalogApi", () => ({
  catalogApi: {
    list: vi.fn(),
    get: vi.fn(),
    categories: vi.fn().mockResolvedValue([{ id: "c1", name: "Audio" }]),
  },
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

const signIn = (role: Role) =>
  tokenStorage.setSession({
    accessToken: "t",
    refreshToken: "r",
    user: { id: "1", name: "Test User", email: "test@prodexa.com", role },
  });

const cartProduct = (id: string): ShopProduct => ({
  id,
  name: `Product ${id}`,
  categoryId: "c1",
  category: "Accessories",
  price: 450,
  inStock: true,
  maxOrderable: 10,
});

const catalogCategoriesMock = vi.mocked(catalogApi.categories);
const privateCategoriesMock = vi.mocked(productsApi.categories);

beforeEach(() => {
  localStorage.clear();
  catalogCategoriesMock.mockClear();
  privateCategoriesMock.mockClear();
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

  it("keeps the user's name out of the header and counts the cart as a badge for customers", () => {
    signIn("CUSTOMER");
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

describe("Header shop icons", () => {
  it("shows cart and favorites to signed-out visitors", () => {
    renderHeader();
    expect(screen.getByRole("link", { name: "Favorites" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cart" })).toBeInTheDocument();
  });

  it("shows cart and favorites to CUSTOMER only", () => {
    signIn("CUSTOMER");
    renderHeader();
    expect(screen.getByRole("link", { name: "Favorites" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cart" })).toBeInTheDocument();
  });

  it.each(["ADMIN", "STAFF", "SUPPORT"] as const)("hides cart and favorites for %s", (role) => {
    signIn(role);
    renderHeader();
    expect(screen.queryByRole("link", { name: "Favorites" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cart" })).not.toBeInTheDocument();
  });
});

describe("Header area links", () => {
  it.each([
    ["ADMIN", "/admin"],
    ["STAFF", "/staff"],
    ["SUPPORT", "/support"],
  ] as const)("gives %s a link to %s", (role, href) => {
    signIn(role);
    renderHeader();
    const links = screen.getAllByRole("link", { name: "Dashboard" });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", href);
  });

  it("gives CUSTOMER a My orders link instead", () => {
    signIn("CUSTOMER");
    renderHeader();
    const links = screen.getAllByRole("link", { name: "My orders" });
    expect(links[0]).toHaveAttribute("href", "/orders");
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
  });
});

describe("Header category menu", () => {
  it.each([
    ["guest", null],
    ["CUSTOMER", "CUSTOMER"],
    ["ADMIN", "ADMIN"],
  ] as const)("uses the public catalog categories for %s", async (_label, role) => {
    if (role) signIn(role);
    renderHeader();

    await waitFor(() => expect(catalogCategoriesMock).toHaveBeenCalled());
    expect(privateCategoriesMock).not.toHaveBeenCalled();
  });

  it("lists the public categories and links them to the shop filter", async () => {
    renderHeader();
    fireEvent.click(screen.getByRole("button", { name: /browse category/i }));

    expect(screen.getByRole("menuitem", { name: "Browse all products" })).toBeInTheDocument();
    expect(await screen.findByRole("menuitem", { name: "Audio" })).toBeInTheDocument();
  });
});
