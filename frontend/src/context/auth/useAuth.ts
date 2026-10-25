import { useContext } from "react";
import { AuthContext } from "./auth-context";

/** const { user, role, login, logout } = useAuth(); */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
