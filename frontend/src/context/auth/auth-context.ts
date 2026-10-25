import { createContext } from "react";
import type { LoginPayload, Role, User } from "../../types/auth";

export type AuthContextValue = {
  user: User | null;
  role: Role | null;
  isAuthenticated: boolean;
  /** Signs in and resolves with the user. Rejects with an ApiError. */
  login: (payload: LoginPayload) => Promise<User>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
