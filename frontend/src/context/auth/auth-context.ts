import { createContext } from "react";
import type { LoginPayload, RegisterPayload, Role, UpdateProfilePayload, User } from "../../types/auth";

export type AuthContextValue = {
  user: User | null;
  role: Role | null;
  isAuthenticated: boolean;
  /** Signs in and resolves with the user. Rejects with an ApiError. */
  login: (payload: LoginPayload) => Promise<User>;
  /** Creates an account (always CUSTOMER) and signs it in. */
  register: (payload: RegisterPayload) => Promise<User>;
  /** Updates the signed-in user's own profile (name and/or password). */
  updateProfile: (payload: UpdateProfilePayload) => Promise<User>;
  /** Uploads a new avatar for the signed-in user and updates the app state. */
  uploadAvatar: (file: File) => Promise<User>;
  /** Removes the signed-in user's avatar and updates the app state. */
  removeAvatar: () => Promise<void>;
  /** Deactivates the signed-in account and clears the local session. */
  deleteAccount: () => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
