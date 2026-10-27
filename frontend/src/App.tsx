import { BrowserRouter, Route, Routes } from "react-router-dom";
import AdminDashboard from "./admin/pages/Dashboard/AdminDashboard";
import Categories from "./admin/pages/Categories/Categories";
import Suppliers from "./admin/pages/Suppliers/Suppliers";
import Header from "./components/header/Header";
import ToastProvider from "./components/ui/toast/ToastProvider";
import AuthProvider from "./context/auth/AuthProvider";
import About from "./page/About/About";
import Contact from "./page/Contact/Contact";
import Dashboard from "./page/Dashboard/Dashboard";
import Forbidden from "./page/Forbidden/Forbidden";
import Home from "./page/home/Home";
import Login from "./page/Login/Login";
import Products from "./page/Products/Products";
import Register from "./page/Register/Register";
import QueryProvider from "./providers/QueryProvider";
import GuestRoute from "./routes/GuestRoute";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleRoute from "./routes/RoleRoute";

export default function App() {
  return (
    <QueryProvider>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
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

                {/* ADMIN only — STAFF is sent to /forbidden */}
                <Route element={<RoleRoute allow={["ADMIN"]} />}>
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/categories" element={<Categories />} />
                  <Route path="/admin/suppliers" element={<Suppliers />} />
                </Route>
              </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryProvider>
  );
}
