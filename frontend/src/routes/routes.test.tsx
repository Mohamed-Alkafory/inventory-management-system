import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tokenStorage } from "../api/tokenStorage";
import AuthProvider from "../context/auth/AuthProvider";
import type { Role } from "../types/auth";
import { AppRoutes } from "../App";

// Leaf pages are replaced with markers: these tests exercise the route table and guards.
vi.mock("../page/home/Home", () => ({ default: () => <p>Home page</p> }));
vi.mock("../page/Login/Login", () => ({ default: () => <p>Login page</p> }));
vi.mock("../page/Register/Register", () => ({ default: () => <p>Register page</p> }));
vi.mock("../page/Cart/Cart", () => ({ default: () => <p>Cart page</p> }));
vi.mock("../page/Checkout/Checkout", () => ({ default: () => <p>Checkout page</p> }));
vi.mock("../page/Favorites/Favorites", () => ({ default: () => <p>Favorites page</p> }));
vi.mock("../page/Orders/MyOrders", () => ({ default: () => <p>My orders page</p> }));
vi.mock("../page/Orders/OrderDetails", () => ({ default: () => <p>Order details page</p> }));
vi.mock("../page/Profile/Profile", () => ({ default: () => <p>Profile page</p> }));
vi.mock("../page/Products/Products", () => ({ default: () => <p>Products page</p> }));
vi.mock("../page/Products/ProductDetail", () => ({ default: () => <p>Product detail page</p> }));
vi.mock("../admin/pages/Orders/NewOrder", () => ({ default: () => <p>New order page</p> }));
vi.mock("../admin/pages/Dashboard/AdminDashboard", () => ({ default: () => <p>Admin dashboard page</p> }));

// Never hit the network: the provider re-validates the stored session through authApi.me().
vi.mock("../api/authApi", () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    me: vi.fn().mockImplementation(() => new Promise(() => {})),
  },
}));

const signIn = (role: Role) =>
  tokenStorage.setSession({
    accessToken: "token",
    refreshToken: "refresh",
    user: { id: "1", name: "Test User", email: "test@prodexa.com", role },
  });

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  );
}

const forbidden = () => screen.getByText("You don’t have access to this page");
const login = () => screen.getByText("Login page");

beforeEach(() => tokenStorage.clear());
afterEach(cleanup);

describe("route access matrix", () => {
  it("sends anonymous visitors on protected routes to /login", () => {
    for (const path of ["/admin", "/staff", "/support", "/cart", "/orders", "/orders/new", "/profile"]) {
      const view = renderAt(path);
      expect(login()).toBeInTheDocument();
      view.unmount();
    }
  });

  it("shows the mounted NotFound for unknown paths", () => {
    renderAt("/no-such-page");
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });

  it("ADMIN may open /admin, /staff, /support, /orders/new and /profile", () => {
    signIn("ADMIN");
    const cases: Array<[string, string]> = [
      ["/admin", "Admin panel"],
      ["/staff", "Staff workspace"],
      ["/support", "Support workspace"],
      ["/orders/new", "New order page"],
      ["/profile", "Profile page"],
    ];
    for (const [path, text] of cases) {
      const view = renderAt(path);
      expect(screen.getByText(text)).toBeInTheDocument();
      view.unmount();
    }
  });

  it("STAFF may open /staff and /orders/new but not /admin, /support or customer pages", () => {
    signIn("STAFF");
    let view = renderAt("/staff");
    expect(screen.getByText("Staff workspace")).toBeInTheDocument();
    view.unmount();

    view = renderAt("/orders/new");
    expect(screen.getByText("New order page")).toBeInTheDocument();
    view.unmount();

    for (const path of ["/admin", "/support", "/cart", "/orders"]) {
      view = renderAt(path);
      expect(forbidden()).toBeInTheDocument();
      view.unmount();
    }
  });

  it("SUPPORT may open /support but not /staff, /admin, /orders/new or customer pages", () => {
    signIn("SUPPORT");
    let view = renderAt("/support");
    expect(screen.getByText("Support workspace")).toBeInTheDocument();
    view.unmount();

    for (const path of ["/admin", "/staff", "/orders/new", "/cart", "/orders"]) {
      view = renderAt(path);
      expect(forbidden()).toBeInTheDocument();
      view.unmount();
    }
  });

  it("CUSTOMER may open /cart and /orders but not staff or admin areas", () => {
    signIn("CUSTOMER");
    let view = renderAt("/cart");
    expect(screen.getByText("Cart page")).toBeInTheDocument();
    view.unmount();

    view = renderAt("/orders");
    expect(screen.getByText("My orders page")).toBeInTheDocument();
    view.unmount();

    for (const path of ["/admin", "/staff", "/support", "/orders/new"]) {
      view = renderAt(path);
      expect(forbidden()).toBeInTheDocument();
      view.unmount();
    }
  });
});

describe("role home redirects", () => {
  it.each([
    ["ADMIN", "Admin dashboard page"],
    ["STAFF", "Staff dashboard"],
    ["SUPPORT", "Support dashboard"],
    ["CUSTOMER", "Home page"],
  ] as const)("sends %s from /dashboard to its own area", (role, text) => {
    signIn(role);
    renderAt("/dashboard");
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it.each([
    ["ADMIN", "Admin dashboard page"],
    ["STAFF", "Staff dashboard"],
    ["SUPPORT", "Support dashboard"],
    ["CUSTOMER", "Home page"],
  ] as const)("sends a signed-in %s away from /login to its own area", (role, text) => {
    signIn(role);
    renderAt("/login");
    expect(screen.getByText(text)).toBeInTheDocument();
  });
});
