import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth/useAuth";
import type { Role } from "../types/auth";

type Props = {
  /** Roles allowed to see the nested routes, e.g. allow={["ADMIN"]}. */
  allow: Role[];
};

/** Role gate. Signed-out → /login, wrong role (e.g. STAFF on an admin page) → /forbidden. */
export default function RoleRoute({ allow }: Props) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!allow.includes(user.role)) return <Navigate to="/forbidden" replace />;
  return <Outlet />;
}
