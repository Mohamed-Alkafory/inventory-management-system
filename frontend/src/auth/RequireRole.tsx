import { Navigate, Outlet } from "react-router-dom";
import { LOGIN_PATH } from "../config";
import { useAuth } from "../context/auth/useAuth";
import type { Role } from "../types/auth";

/** Route guard: not signed in → login, wrong role → 403. */
export default function RequireRole({ roles }: { roles: Role[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to={LOGIN_PATH} replace />;
  if (!roles.includes(user.role)) return <Navigate to="/403" replace />;
  return <Outlet />;
}
