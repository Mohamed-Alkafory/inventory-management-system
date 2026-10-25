import { Navigate, Outlet } from "react-router-dom";
import { LOGIN_PATH } from "../config";
import { useAuth } from "./useAuth";
import type { Role } from "./auth-context";

/** Route guard: not signed in → login, wrong role → 403. */
export default function RequireRole({ roles }: { roles: Role[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to={LOGIN_PATH} replace />;
  if (!roles.includes(user.role)) return <Navigate to="/403" replace />;
  return <Outlet />;
}
