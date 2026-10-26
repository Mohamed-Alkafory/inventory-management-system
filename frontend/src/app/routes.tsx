/* eslint-disable react-refresh/only-export-components -- route config, not a component module */
import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import PublicLayout from "../layouts/PublicLayout";
import RequireRole from "../auth/RequireRole";
import GuestRoute from "../routes/GuestRoute";
import ProtectedRoute from "../routes/ProtectedRoute";

// Every page is lazy-loaded (one chunk per page).
const Home = lazy(() => import("../page/home/Home"));
const About = lazy(() => import("../page/About/About"));
const Contact = lazy(() => import("../page/Contact/Contact"));
const Login = lazy(() => import("../page/Login/Login"));
const Register = lazy(() => import("../page/Register/Register"));
const Dashboard = lazy(() => import("../page/Dashboard/Dashboard"));
const Products = lazy(() => import("../page/Products/Products"));
const SellerOnboarding = lazy(() => import("../page/seller/SellerOnboarding"));
const Inventory = lazy(() => import("../page/app/Inventory"));
const Orders = lazy(() => import("../page/app/Orders"));
const Suppliers = lazy(() => import("../page/app/Suppliers"));
const Reports = lazy(() => import("../page/app/Reports"));
const Settings = lazy(() => import("../page/app/Settings"));
const Users = lazy(() => import("../page/app/Users"));
const AuditLog = lazy(() => import("../page/app/AuditLog"));
const Forbidden = lazy(() => import("../page/app/Forbidden"));
const NotFound = lazy(() => import("../page/app/NotFound"));

export const router = createBrowserRouter([
  // Public marketing site: anyone can browse these pages.
  {
    path: "/",
    element: <PublicLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "about", element: <About /> },
      { path: "contact", element: <Contact /> },
    ],
  },

  // Only for signed-out visitors.
  {
    element: <GuestRoute />,
    children: [
      { path: "/login", element: <Login /> },
      { path: "/register", element: <Register /> },
    ],
  },

  // Any signed-in user.
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <AppLayout />,
        children: [
          { path: "dashboard", element: <Dashboard /> },
          { path: "products", element: <Products /> },
          { path: "seller/onboarding", element: <SellerOnboarding /> },
          { path: "inventory", element: <Inventory /> },
          { path: "orders", element: <Orders /> },
          { path: "suppliers", element: <Suppliers /> },
          { path: "reports", element: <Reports /> },
          { path: "settings", element: <Settings /> },

          // admin-only
          {
            element: <RequireRole roles={["ADMIN"]} />,
            children: [
              { path: "users", element: <Users /> },
              { path: "audit-log", element: <AuditLog /> },
            ],
          },

          { path: "403", element: <Forbidden /> },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);
