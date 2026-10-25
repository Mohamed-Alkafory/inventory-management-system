import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth/useAuth";

/** Wrap private routes: unauthenticated visitors are sent to /login (and back afterwards). */
export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}
