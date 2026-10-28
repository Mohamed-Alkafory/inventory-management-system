import { createContext } from "react";
import type { LoginPayload, RegisterPayload, Role, UpdateProfilePayload, User } from "../../types/auth";

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
  /** Updates the signed-in user's own profile (name and/or password). */
  updateProfile: (payload: UpdateProfilePayload) => Promise<User>;
  /** Deactivates the signed-in account and clears the local session. */
  deleteAccount: () => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
