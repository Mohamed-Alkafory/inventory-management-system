import { Navigate } from "react-router-dom";
import { useAuth } from "../context/auth/useAuth";
import { homePathForRole } from "./redirect";

/** /dashboard is a compatibility redirect: each role lands in its own area. */
export default function RoleHomeRedirect() {
  const { role } = useAuth();
  return <Navigate to={homePathForRole(role)} replace />;
}
