import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

function renderHeader(path = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
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

  it("gives CUSTOMER a Dashboard link to their own area", () => {
    signIn("CUSTOMER");
    renderHeader();
    const links = screen.getAllByRole("link", { name: "Dashboard" });
    expect(links[0]).toHaveAttribute("href", "/dashboard");
  });
});

describe("Header stays inside the current dashboard", () => {
  it("maps Dashboard and Products to the admin area when inside /admin", () => {
    signIn("ADMIN");
    renderHeader("/admin/orders");

    expect(screen.getAllByRole("link", { name: "Dashboard" })[0]).toHaveAttribute("href", "/admin");
    const products = screen.getAllByRole("link", { name: "Products" });
    expect(products.some((link) => link.getAttribute("href") === "/admin/products")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Your profile" })[0]).toHaveAttribute(
      "href",
      "/admin/profile",
    );
  });

  it.each([
    ["STAFF", "/staff/orders", "/staff/products"],
    ["SUPPORT", "/support/messages", "/support/products"],
  ] as const)(
    "keeps %s inside its dashboard (%s → %s)",
    (role, path, productsHref) => {
      signIn(role);
      renderHeader(path);

      const products = screen.getAllByRole("link", { name: "Products" });
      expect(products.some((link) => link.getAttribute("href") === productsHref)).toBe(true);
    },
  );

  it.each([
    ["ADMIN", "/admin/products"],
    ["STAFF", "/staff/products"],
    ["SUPPORT", "/support/products"],
    ["CUSTOMER", "/dashboard/products"],
  ] as const)(
    "opens Products in the %s dashboard even from the storefront",
    (role, href) => {
      signIn(role);
      renderHeader("/");

      const products = screen.getAllByRole("link", { name: "Products" });
      expect(products.some((link) => link.getAttribute("href") === href)).toBe(true);
    },
  );

  it.each([
    ["ADMIN", "/admin/profile"],
    ["STAFF", "/staff/profile"],
    ["SUPPORT", "/support/profile"],
    ["CUSTOMER", "/dashboard/profile"],
  ] as const)(
    "opens Profile in the %s dashboard even from the storefront",
    (role, href) => {
      signIn(role);
      renderHeader("/");

      expect(screen.getAllByRole("link", { name: "Your profile" })[0]).toHaveAttribute("href", href);
    },
  );

  it("opens Products and Profile inside the customer dashboard", () => {
    signIn("CUSTOMER");
    renderHeader("/dashboard/orders");

    const products = screen.getAllByRole("link", { name: "Products" });
    expect(products.some((link) => link.getAttribute("href") === "/dashboard/products")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Dashboard" })[0]).toHaveAttribute("href", "/dashboard");
    expect(screen.getAllByRole("link", { name: "Your profile" })[0]).toHaveAttribute(
      "href",
      "/dashboard/profile",
    );
  });
});

describe("Header navigation", () => {
  it("links the brand, primary nav and account entry points", () => {
    renderHeader();

    expect(screen.getByRole("link", { name: /prodexa home/i })).toHaveAttribute("href", "/");
    const products = screen.getAllByRole("link", { name: "Products" });
    expect(products.some((link) => link.getAttribute("href") === "/products")).toBe(true);
    const login = screen.getAllByRole("link", { name: /log in/i });
    expect(login.some((link) => link.getAttribute("href") === "/login")).toBe(true);
  });
});
