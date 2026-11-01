import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ColdStartBanner from "./components/ColdStartBanner";
import Header from "./components/header/Header";
import PageLoader from "./components/PageLoader";
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
import NotificationsPage from "./features/notifications/NotificationsPage";
import { ADMIN_ORDERS_PATH } from "./features/orders/format";

/*
  The shop and public pages stay in the main bundle. The admin, staff and
  support workspaces are only loaded when a user opens them, so a storefront
  visitor does not download the dashboards, tables and charting code.
*/
const AdminLayout = lazy(() => import("./admin/layouts/AdminLayout"));
const AdminDashboard = lazy(() => import("./admin/pages/Dashboard/AdminDashboard"));
const AdminProducts = lazy(() => import("./admin/pages/Products/AdminProducts"));
const Reports = lazy(() => import("./admin/pages/Reports/Reports"));
const Categories = lazy(() => import("./admin/pages/Categories/Categories"));
const Inventory = lazy(() => import("./admin/pages/Inventory/Inventory"));
const Suppliers = lazy(() => import("./admin/pages/Suppliers/Suppliers"));
const Users = lazy(() => import("./admin/pages/Users/Users"));
const Audit = lazy(() => import("./admin/pages/Audit/Audit"));
const PurchaseOrders = lazy(() => import("./admin/pages/PurchaseOrders/PurchaseOrders"));
const PurchaseOrderDetails = lazy(() => import("./admin/pages/PurchaseOrders/PurchaseOrderDetails"));

const StaffLayout = lazy(() => import("./staff/layouts/StaffLayout"));
const StaffDashboard = lazy(() => import("./staff/pages/Dashboard/StaffDashboard"));
const StaffInventory = lazy(() => import("./staff/pages/Inventory/Inventory"));
const StaffPurchaseOrders = lazy(() => import("./staff/pages/PurchaseOrders/PurchaseOrders"));
const StaffPurchaseOrderDetails = lazy(() => import("./staff/pages/PurchaseOrders/PurchaseOrderDetails"));
const StaffOrderDetailsPage = lazy(() => import("./features/orders/StaffOrderDetailsPage"));
const StaffOrdersPage = lazy(() => import("./features/orders/StaffOrdersPage"));
const NewOrderFlow = lazy(() => import("./features/orders/create/NewOrderFlow"));
const StaffProducts = lazy(() => import("./features/products/StaffProducts"));
const StaffProductDetails = lazy(() => import("./features/products/StaffProductDetails"));

const SupportLayout = lazy(() => import("./support/layouts/SupportLayout"));
const SupportDashboard = lazy(() => import("./support/pages/Dashboard/SupportDashboard"));
const SupportMessages = lazy(() => import("./support/pages/Messages/Messages"));
const SupportMessageDetails = lazy(() => import("./support/pages/Messages/MessageDetails"));
const SupportOrders = lazy(() => import("./support/pages/Orders/Orders"));
const SupportOrderDetails = lazy(() => import("./support/pages/Orders/OrderDetails"));

/**
 * The route table on its own so tests can mount it with a MemoryRouter.
 * Access rules: public → guest-only → any signed-in → role groups.
 */
export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
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
    </Suspense>
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
                <ColdStartBanner />

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
