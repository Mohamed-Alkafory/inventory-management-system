/* eslint-disable react-refresh/only-export-components -- route config, not a component module */
import { lazy } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import RequireRole from "../auth/RequireRole";

// Every page is lazy-loaded (one chunk per page).
const Dashboard = lazy(() => import("../page/app/Dashboard"));
const Products = lazy(() => import("../page/app/Products"));
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
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "products", element: <Products /> },
      { path: "inventory", element: <Inventory /> },
      { path: "orders", element: <Orders /> },
      { path: "suppliers", element: <Suppliers /> },
      { path: "reports", element: <Reports /> },
      { path: "settings", element: <Settings /> },

      // admin-only
      {
        element: <RequireRole roles={["admin"]} />,
        children: [
          { path: "users", element: <Users /> },
          { path: "audit-log", element: <AuditLog /> },
        ],
      },

      { path: "403", element: <Forbidden /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
