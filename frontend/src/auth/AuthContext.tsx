import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AuthContext } from "./auth-context";
import type { AuthState, AuthUser } from "./auth-context";

/**
 * PLACEHOLDER. Swap the body for your real auth (API / token / etc.).
 * The shell only needs `user` (with a role) and `logout()`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>({
    name: "Demo Admin",
    email: "admin@prodexa.com",
    role: "admin",
  });

  const value = useMemo<AuthState>(() => ({ user, logout: () => setUser(null) }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
