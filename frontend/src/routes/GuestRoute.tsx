import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth/useAuth";
import { getPostLoginTarget } from "./redirect";

/** For /login: signed-in users are bounced to where they were going (or the home page). */
export default function GuestRoute() {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();

  if (isAuthenticated) return <Navigate to={getPostLoginTarget(location.state, role)} replace />;
  return <Outlet />;
}
