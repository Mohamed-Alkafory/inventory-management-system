import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tokenStorage } from "../../api/tokenStorage";
import AuthProvider from "../../context/auth/AuthProvider";
import type { Role } from "../../types/auth";
import SiteFooter from "./SiteFooter";
import { isStorefrontPath } from "./storefrontPaths";

vi.mock("../../api/authApi", () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    me: vi.fn().mockImplementation(() => new Promise(() => {})),
    updateProfile: vi.fn(),
    uploadAvatar: vi.fn(),
    removeAvatar: vi.fn(),
    deleteAccount: vi.fn(),
  },
}));

const renderAt = (pathname: string) =>
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <AuthProvider>
        <SiteFooter />
      </AuthProvider>
    </MemoryRouter>,
  );

const signIn = (role: Role) =>
  tokenStorage.setSession({
    accessToken: "t",
    refreshToken: "r",
    user: { id: "1", name: "Test User", email: "test@prodexa.com", role },
  });

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("isStorefrontPath", () => {
  it("matches public storefront pages", () => {
    for (const path of ["/", "/about", "/contact", "/products", "/products/42", "/products?q=box"]) {
      expect(isStorefrontPath(path)).toBe(true);
    }
  });

  it("excludes dashboards, auth and account pages", () => {
    for (const path of ["/admin", "/staff/orders", "/support", "/login", "/register", "/profile", "/settings", "/cart"]) {
      expect(isStorefrontPath(path)).toBe(false);
    }
  });
});

describe("SiteFooter", () => {
  it("renders on a storefront page", () => {
    renderAt("/about");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("does not render on app pages", () => {
    renderAt("/admin");
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });

  it("keeps public links for guests", () => {
    renderAt("/about");

    expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute("href", "/products");
    expect(screen.getByRole("link", { name: "My profile" })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("link", { name: "My orders" })).toHaveAttribute("href", "/orders");
    expect(screen.getByRole("link", { name: "Favorites" })).toHaveAttribute("href", "/favorites");
    expect(screen.getByRole("link", { name: "Cart" })).toHaveAttribute("href", "/cart");
  });

  it.each([
    ["ADMIN", "/admin"],
    ["STAFF", "/staff"],
    ["SUPPORT", "/support"],
    ["CUSTOMER", "/dashboard"],
  ] as const)("opens signed-in %s links inside their dashboard", (role, base) => {
    signIn(role);
    renderAt("/about");

    expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute("href", `${base}/products`);
    expect(screen.getByRole("link", { name: "My profile" })).toHaveAttribute("href", `${base}/profile`);
    expect(screen.getByRole("link", { name: "My orders" })).toHaveAttribute("href", `${base}/orders`);
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", `${base}/settings`);
  });

  it("hides storefront-only links for non-customer roles", () => {
    signIn("ADMIN");
    renderAt("/about");

    expect(screen.queryByRole("link", { name: "Favorites" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cart" })).not.toBeInTheDocument();
  });

  it("keeps favorites and cart inside the customer dashboard", () => {
    signIn("CUSTOMER");
    renderAt("/about");

    expect(screen.getByRole("link", { name: "Favorites" })).toHaveAttribute("href", "/dashboard/favorites");
    expect(screen.getByRole("link", { name: "Cart" })).toHaveAttribute("href", "/dashboard/cart");
  });
});