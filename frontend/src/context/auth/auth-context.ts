import { createContext } from "react";
import type { LoginPayload, RegisterPayload, Role, User } from "../../types/auth";

export type AuthContextValue = {
  user: User | null;
  role: Role | null;
  isAuthenticated: boolean;
  /** Signs in and resolves with the user. Rejects with an ApiError. */
  login: (payload: LoginPayload) => Promise<User>;
  /** Creates an account (always STAFF) and signs it in. */
  register: (payload: RegisterPayload) => Promise<User>;
  /** Signs in / up with a Google ID token. */
  loginWithGoogle: (idToken: string) => Promise<User>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
