import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "./admin/layouts/AdminLayout";
import AdminDashboard from "./admin/pages/Dashboard/AdminDashboard";
import AdminProducts from "./admin/pages/Products/AdminProducts";
import Reports from "./admin/pages/Reports/Reports";
import Categories from "./admin/pages/Categories/Categories";
import Inventory from "./admin/pages/Inventory/Inventory";
import Suppliers from "./admin/pages/Suppliers/Suppliers";
import Users from "./admin/pages/Users/Users";
import Audit from "./admin/pages/Audit/Audit";
import PurchaseOrders from "./admin/pages/PurchaseOrders/PurchaseOrders";
import PurchaseOrderDetails from "./admin/pages/PurchaseOrders/PurchaseOrderDetails";
import Header from "./components/header/Header";
import ScrollToTop from "./components/ScrollToTop";
import SiteFooter from "./components/footer/SiteFooter";
import ToastProvider from "./components/ui/toast/ToastProvider";
import AuthProvider from "./context/auth/AuthProvider";
import CartProvider from "./context/cart/CartProvider";
import FavoritesProvider from "./context/favorites/FavoritesProvider";
import CustomerLayout from "./customer/layouts/CustomerLayout";
import About from "./page/About/About";
import Cart from "./page/Cart/Cart";
import Checkout from "./page/Checkout/Checkout";
import Favorites from "./page/Favorites/Favorites";
import Contact from "./page/Contact/Contact";
import Forbidden from "./page/Forbidden/Forbidden";
import Home from "./page/home/Home";
import Login from "./page/Login/Login";
import NotFound from "./page/NotFound/NotFound";
import ShopProducts from "./page/Products/ShopProducts";
import ProductDetail from "./page/Products/ProductDetail";
import Register from "./page/Register/Register";
import MyOrders from "./page/Orders/MyOrders";
import OrderDetails from "./page/Orders/OrderDetails";
import QueryProvider from "./providers/QueryProvider";
import GuestRoute from "./routes/GuestRoute";
import LegacyRedirect from "./routes/LegacyRedirect";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleRoute from "./routes/RoleRoute";
import Profile from "./page/Profile/Profile";
import Settings from "./page/app/Settings";
import StaffLayout from "./staff/layouts/StaffLayout";
import StaffDashboard from "./staff/pages/Dashboard/StaffDashboard";
import StaffInventory from "./staff/pages/Inventory/Inventory";
import StaffPurchaseOrders from "./staff/pages/PurchaseOrders/PurchaseOrders";
import StaffPurchaseOrderDetails from "./staff/pages/PurchaseOrders/PurchaseOrderDetails";
import StaffOrderDetailsPage from "./features/orders/StaffOrderDetailsPage";
import StaffOrdersPage from "./features/orders/StaffOrdersPage";
import NewOrderFlow from "./features/orders/create/NewOrderFlow";
import { ADMIN_ORDERS_PATH } from "./features/orders/format";
import StaffProducts from "./features/products/StaffProducts";
import StaffProductDetails from "./features/products/StaffProductDetails";
import SupportLayout from "./support/layouts/SupportLayout";
import SupportDashboard from "./support/pages/Dashboard/SupportDashboard";
import SupportMessages from "./support/pages/Messages/Messages";
import SupportMessageDetails from "./support/pages/Messages/MessageDetails";
import SupportOrders from "./support/pages/Orders/Orders";
import SupportOrderDetails from "./support/pages/Orders/OrderDetails";
import NotificationsPage from "./features/notifications/NotificationsPage";

/**
 * The route table on its own so tests can mount it with a MemoryRouter.
 * Access rules: public → guest-only → any signed-in → role groups.
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/forbidden" element={<Forbidden />} />
      {/* Public storefront: browsing never requires a token. */}
      <Route path="/products" element={<ShopProducts />} />
      <Route path="/products/:id" element={<ProductDetail />} />

      {/* Only for signed-out visitors */}
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* Any signed-in user */}
      <Route element={<ProtectedRoute />}>
        {/* Top-level shared pages (standalone — no dashboard shell). */}
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/notifications" element={<NotificationsPage />} />

        {/* CUSTOMER only — their own dashboard shell at /dashboard. */}
        <Route element={<RoleRoute allow={["CUSTOMER"]} />}>
          <Route path="/dashboard" element={<CustomerLayout />}>
            <Route index element={<Navigate to="products" replace />} />
            <Route path="products" element={<ShopProducts />} />
            <Route path="products/:id" element={<ProductDetail />} />
            <Route path="orders" element={<MyOrders />} />
            <Route path="orders/:id" element={<OrderDetails />} />
            <Route path="favorites" element={<Favorites />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Legacy top-level customer URLs now open inside the dashboard. */}
          <Route path="/cart" element={<LegacyRedirect to="/dashboard/cart" />} />
          <Route path="/checkout" element={<LegacyRedirect to="/dashboard/checkout" />} />
          <Route path="/favorites" element={<LegacyRedirect to="/dashboard/favorites" />} />
          <Route path="/orders" element={<LegacyRedirect to="/dashboard/orders" />} />
          <Route path="/orders/:id" element={<LegacyRedirect to="/dashboard/orders/:id" />} />
        </Route>

        {/* STAFF + ADMIN — staff workspace (admin can use it too) */}
        <Route element={<RoleRoute allow={["ADMIN", "STAFF"]} />}>
          {/* Old builder URL: keep the link working for both roles. */}
          <Route path="/orders/new" element={<Navigate to="/staff/orders/new" replace />} />
          <Route path="/staff" element={<StaffLayout />}>
            <Route index element={<StaffDashboard />} />
            <Route path="orders" element={<StaffOrdersPage />} />
            <Route path="orders/new" element={<NewOrderFlow />} />
            <Route path="orders/:id" element={<StaffOrderDetailsPage />} />
            <Route path="inventory" element={<StaffInventory />} />
            <Route path="purchase-orders" element={<StaffPurchaseOrders />} />
            <Route path="purchase-orders/:id" element={<StaffPurchaseOrderDetails />} />
            <Route path="products" element={<StaffProducts />} />
            <Route path="products/:id" element={<StaffProductDetails />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>

        {/* SUPPORT + ADMIN */}
        <Route element={<RoleRoute allow={["ADMIN", "SUPPORT"]} />}>
          <Route path="/support" element={<SupportLayout />}>
            <Route index element={<SupportDashboard />} />
            <Route path="messages" element={<SupportMessages />} />
            <Route path="messages/:id" element={<SupportMessageDetails />} />
            <Route path="orders" element={<SupportOrders />} />
            <Route path="orders/:id" element={<SupportOrderDetails />} />
            <Route path="products" element={<StaffProducts basePath="/support" />} />
            <Route path="products/:id" element={<StaffProductDetails basePath="/support" />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>

        {/* ADMIN only — STAFF/SUPPORT/CUSTOMER are sent to /forbidden */}
        <Route element={<RoleRoute allow={["ADMIN"]} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/:id" element={<StaffProductDetails basePath="/admin" />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="categories" element={<Categories />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="purchase-orders" element={<PurchaseOrders />} />
            <Route path="purchase-orders/:id" element={<PurchaseOrderDetails />} />
            {/* Same staff-scope order screens, mounted under the admin area. */}
            <Route path="orders" element={<StaffOrdersPage basePath={ADMIN_ORDERS_PATH} newOrderPath={`${ADMIN_ORDERS_PATH}/new`} />} />
            <Route path="orders/new" element={<NewOrderFlow basePath={ADMIN_ORDERS_PATH} />} />
            <Route path="orders/:id" element={<StaffOrderDetailsPage basePath={ADMIN_ORDERS_PATH} />} />
            <Route path="reports" element={<Reports />} />
            <Route path="users" element={<Users />} />
            <Route path="audit-logs" element={<Audit />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>
      </Route>

      {/* Mounted catch-all for unknown paths */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryProvider>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <CartProvider>
              <FavoritesProvider>
                <ScrollToTop />
                <Header />

                <AppRoutes />
                <SiteFooter />
              </FavoritesProvider>
            </CartProvider>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryProvider>
  );
}
