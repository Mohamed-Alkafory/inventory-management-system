import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
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
vi.mock("../page/Products/ShopProducts", () => ({ default: () => <p>Products page</p> }));
vi.mock("../page/Products/ProductDetail", () => ({ default: () => <p>Product detail page</p> }));
vi.mock("../admin/pages/Dashboard/AdminDashboard", () => ({ default: () => <p>Admin dashboard page</p> }));
vi.mock("../admin/pages/Reports/Reports", () => ({ default: () => <p>Admin reports page</p> }));
vi.mock("../features/orders/create/NewOrderFlow", () => ({ default: () => <p>New order page</p> }));
vi.mock("../features/orders/StaffOrdersPage", () => ({ default: () => <p>Staff orders page</p> }));
vi.mock("../features/orders/StaffOrderDetailsPage", () => ({ default: () => <p>Staff order details page</p> }));
vi.mock("../features/products/StaffProducts", () => ({ default: () => <p>Staff products page</p> }));
vi.mock("../features/products/StaffProductDetails", () => ({ default: () => <p>Staff product details page</p> }));
vi.mock("../staff/pages/Dashboard/StaffDashboard", () => ({ default: () => <p>Staff dashboard</p> }));
vi.mock("../staff/pages/Inventory/Inventory", () => ({ default: () => <p>Staff inventory page</p> }));
vi.mock("../staff/pages/PurchaseOrders/PurchaseOrders", () => ({ default: () => <p>Staff purchase orders page</p> }));
vi.mock("../staff/pages/PurchaseOrders/PurchaseOrderDetails", () => ({ default: () => <p>Staff purchase order details page</p> }));
vi.mock("../support/pages/Dashboard/SupportDashboard", () => ({ default: () => <p>Support dashboard</p> }));
vi.mock("../support/pages/Messages/Messages", () => ({ default: () => <p>Support messages page</p> }));
vi.mock("../support/pages/Messages/MessageDetails", () => ({ default: () => <p>Support message details page</p> }));
vi.mock("../support/pages/Orders/Orders", () => ({ default: () => <p>Support orders page</p> }));
vi.mock("../support/pages/Orders/OrderDetails", () => ({ default: () => <p>Support order details page</p> }));
vi.mock("../features/notifications/NotificationsPage", () => ({ default: () => <p>Notifications page</p> }));
vi.mock("../features/notifications/NotificationBell", () => ({ default: () => <span>Notification bell</span> }));

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
    for (const path of ["/admin", "/admin/reports", "/staff", "/support", "/dashboard", "/cart", "/orders", "/orders/new", "/notifications", "/profile"]) {
      const view = renderAt(path);
      expect(login()).toBeInTheDocument();
      view.unmount();
    }
  });

  it("shows the mounted NotFound for unknown paths", () => {
    renderAt("/no-such-page");
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });

  it("lets anonymous visitors browse /products and /products/:id", () => {
    let view = renderAt("/products");
    expect(screen.getByText("Products page")).toBeInTheDocument();
    view.unmount();

    view = renderAt("/products/p-1");
    expect(screen.getByText("Product detail page")).toBeInTheDocument();
    view.unmount();
  });

  it("ADMIN may open /admin, the staff workspace and /support but not customer pages", () => {
    signIn("ADMIN");
    const cases: Array<[string, string]> = [
      ["/admin", "Admin panel"],
      ["/admin/reports", "Admin reports page"],
      ["/admin/orders", "Staff orders page"],
      ["/admin/orders/new", "New order page"],
      ["/admin/orders/o-1", "Staff order details page"],
      ["/staff", "Staff dashboard"],
      ["/staff/orders", "Staff orders page"],
      ["/staff/orders/new", "New order page"],
      ["/staff/inventory", "Staff inventory page"],
      ["/staff/purchase-orders", "Staff purchase orders page"],
      ["/staff/products", "Staff products page"],
      ["/support", "Support workspace"],
      ["/support/messages", "Support messages page"],
      ["/support/messages/m-1", "Support message details page"],
      ["/support/orders", "Support orders page"],
      ["/support/orders/o-1", "Support order details page"],
      ["/support/products", "Staff products page"],
      ["/support/products/p-1", "Staff product details page"],
      ["/admin/notifications", "Notifications page"],
      ["/admin/profile", "Profile page"],
      ["/staff/notifications", "Notifications page"],
      ["/support/notifications", "Notifications page"],
      ["/notifications", "Notifications page"],
      ["/profile", "Profile page"],
    ];
    for (const [path, text] of cases) {
      const view = renderAt(path);
      expect(screen.getByText(text)).toBeInTheDocument();
      view.unmount();
    }
  });

  it("shows Orders and Reports links in the admin sidebar without a cross-area Support link", () => {
    signIn("ADMIN");
    renderAt("/admin");

    const nav = screen.getByRole("navigation", { name: "Admin" });
    expect(within(nav).getByRole("link", { name: "Orders" })).toHaveAttribute("href", "/admin/orders");
    expect(within(nav).getByRole("link", { name: "Reports" })).toHaveAttribute("href", "/admin/reports");
    // Support is its own workspace; the admin sidebar must not jump into it.
    expect(within(nav).queryByRole("link", { name: "Support" })).not.toBeInTheDocument();
  });

  it("shows a Products link in the support sidebar", () => {
    signIn("SUPPORT");
    renderAt("/support");

    const nav = screen.getByRole("navigation", { name: "Support" });
    expect(within(nav).getByRole("link", { name: "Products" })).toHaveAttribute(
      "href",
      "/support/products",
    );
  });

  it("redirects the old /orders/new URL to /staff/orders/new for ADMIN and STAFF", async () => {
    for (const role of ["ADMIN", "STAFF"] as const) {
      signIn(role);
      const view = renderAt("/orders/new");
      expect(await screen.findByText("New order page")).toBeInTheDocument();
      view.unmount();
    }
  });

  it("STAFF may open every /staff page but not /admin, /support or customer pages", () => {
    signIn("STAFF");
    const allowed: Array<[string, string]> = [
      ["/staff", "Staff dashboard"],
      ["/staff/orders", "Staff orders page"],
      ["/staff/orders/new", "New order page"],
      ["/staff/orders/o-1", "Staff order details page"],
      ["/staff/inventory", "Staff inventory page"],
      ["/staff/purchase-orders", "Staff purchase orders page"],
      ["/staff/purchase-orders/po-1", "Staff purchase order details page"],
      ["/staff/products", "Staff products page"],
      ["/staff/products/p-1", "Staff product details page"],
      ["/notifications", "Notifications page"],
    ];
    for (const [path, text] of allowed) {
      const view = renderAt(path);
      expect(screen.getByText(text)).toBeInTheDocument();
      view.unmount();
    }

    for (const path of ["/admin", "/admin/orders", "/admin/reports", "/support", "/support/messages", "/support/orders", "/cart", "/orders"]) {
      const view = renderAt(path);
      expect(forbidden()).toBeInTheDocument();
      view.unmount();
    }
  });

  it("SUPPORT may open every /support page but not /staff, /admin, /orders/new or customer pages", () => {
    signIn("SUPPORT");
    const allowed: Array<[string, string]> = [
      ["/support", "Support workspace"],
      ["/support/messages", "Support messages page"],
      ["/support/messages/m-1", "Support message details page"],
      ["/support/orders", "Support orders page"],
      ["/support/orders/o-1", "Support order details page"],
      ["/support/products", "Staff products page"],
      ["/support/products/p-1", "Staff product details page"],
      ["/notifications", "Notifications page"],
    ];
    for (const [path, text] of allowed) {
      const view = renderAt(path);
      expect(screen.getByText(text)).toBeInTheDocument();
      view.unmount();
    }

    for (const path of ["/admin", "/admin/orders", "/admin/reports", "/staff", "/staff/orders", "/staff/inventory", "/orders/new", "/cart", "/orders"]) {
      const view = renderAt(path);
      expect(forbidden()).toBeInTheDocument();
      view.unmount();
    }
  });

  it("CUSTOMER gets their own dashboard at /dashboard and legacy URLs redirect into it", async () => {
    signIn("CUSTOMER");

    let view = renderAt("/dashboard");
    expect(await screen.findByText("Products page")).toBeInTheDocument();
    view.unmount();

    view = renderAt("/dashboard/cart");
    expect(screen.getByText("Cart page")).toBeInTheDocument();
    view.unmount();

    view = renderAt("/dashboard/products/p-1");
    expect(screen.getByText("Product detail page")).toBeInTheDocument();
    view.unmount();

    // Old top-level customer URLs now redirect inside the dashboard.
    view = renderAt("/cart");
    expect(await screen.findByText("Cart page")).toBeInTheDocument();
    view.unmount();

    view = renderAt("/orders");
    expect(await screen.findByText("My orders page")).toBeInTheDocument();
    view.unmount();

    view = renderAt("/notifications");
    expect(screen.getByText("Notifications page")).toBeInTheDocument();
    view.unmount();

    for (const path of ["/admin", "/admin/orders", "/admin/reports", "/staff", "/staff/orders", "/staff/products", "/support", "/support/messages", "/support/orders", "/orders/new"]) {
      view = renderAt(path);
      expect(forbidden()).toBeInTheDocument();
      view.unmount();
    }
  });
});

describe("role home redirects", () => {
  it("shows the customer dashboard at /dashboard for CUSTOMER", async () => {
    signIn("CUSTOMER");
    renderAt("/dashboard");
    expect(await screen.findByText("Products page")).toBeInTheDocument();
  });

  it.each(["ADMIN", "STAFF", "SUPPORT"] as const)(
    "sends %s away from the customer /dashboard to /forbidden",
    (role) => {
      signIn(role);
      renderAt("/dashboard");
      expect(forbidden()).toBeInTheDocument();
    },
  );

  it.each([
    ["ADMIN", "Admin dashboard page"],
    ["STAFF", "Staff dashboard"],
    ["SUPPORT", "Support dashboard"],
    ["CUSTOMER", "Products page"],
  ] as const)("sends a signed-in %s away from /login to its own area", (role, text) => {
    signIn(role);
    renderAt("/login");
    expect(screen.getByText(text)).toBeInTheDocument();
  });
});
