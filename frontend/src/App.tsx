import { BrowserRouter, Route, Routes } from "react-router-dom";
import AdminLayout from "./admin/layouts/AdminLayout";
import AdminDashboard from "./admin/pages/Dashboard/AdminDashboard";
import AdminProducts from "./admin/pages/Products/AdminProducts";
import Categories from "./admin/pages/Categories/Categories";
import Inventory from "./admin/pages/Inventory/Inventory";
import Suppliers from "./admin/pages/Suppliers/Suppliers";
import Users from "./admin/pages/Users/Users";
import Audit from "./admin/pages/Audit/Audit";
import PurchaseOrders from "./admin/pages/PurchaseOrders/PurchaseOrders";
import PurchaseOrderDetails from "./admin/pages/PurchaseOrders/PurchaseOrderDetails";
import Header from "./components/header/Header";
import ToastProvider from "./components/ui/toast/ToastProvider";
import AuthProvider from "./context/auth/AuthProvider";
import CartProvider from "./context/cart/CartProvider";
import FavoritesProvider from "./context/favorites/FavoritesProvider";
import About from "./page/About/About";
import Cart from "./page/Cart/Cart";
import Checkout from "./page/Checkout/Checkout";
import Favorites from "./page/Favorites/Favorites";
import Contact from "./page/Contact/Contact";
import Dashboard from "./page/Dashboard/Dashboard";
import Forbidden from "./page/Forbidden/Forbidden";
import Home from "./page/home/Home";
import Login from "./page/Login/Login";
import Products from "./page/Products/Products";
import ProductDetail from "./page/Products/ProductDetail";
import Register from "./page/Register/Register";
import MyOrders from "./page/Orders/MyOrders";
import OrderDetails from "./page/Orders/OrderDetails";
import QueryProvider from "./providers/QueryProvider";
import GuestRoute from "./routes/GuestRoute";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleRoute from "./routes/RoleRoute";
import Profile from "./page/Profile/Profile";
import Settings from "./page/Settings/Settings";

export default function App() {
  return (
    <QueryProvider>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <CartProvider>
              <FavoritesProvider>
                <Header />

                <Routes>
                  {/* Public */}
                  <Route path="/" element={<Home />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/forbidden" element={<Forbidden />} />

                  {/* Only for signed-out visitors */}
                  <Route element={<GuestRoute />}>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                  </Route>

                  {/* Any signed-in user */}
                  <Route element={<ProtectedRoute />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="/products/:id" element={<ProductDetail />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/favorites" element={<Favorites />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/orders" element={<MyOrders />} />
                    <Route path="/orders/:id" element={<OrderDetails />} />

                    {/* ADMIN only — STAFF is sent to /forbidden */}
                    <Route element={<RoleRoute allow={["ADMIN"]} />}>
                      <Route path="/admin" element={<AdminLayout />}>
                        <Route index element={<AdminDashboard />} />
                        <Route path="products" element={<AdminProducts />} />
                        <Route path="inventory" element={<Inventory />} />
                        <Route path="categories" element={<Categories />} />
                        <Route path="suppliers" element={<Suppliers />} />
                        <Route path="purchase-orders" element={<PurchaseOrders />} />
                        <Route path="purchase-orders/:id" element={<PurchaseOrderDetails />} />
                        <Route path="users" element={<Users />} />
                        <Route path="audit-logs" element={<Audit />} />
                      </Route>
                    </Route>
                  </Route>
                </Routes>
              </FavoritesProvider>
            </CartProvider>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryProvider>
  );
}
