import { createContext } from "react";

export type Role = "admin" | "staff";

export interface AuthUser {
  name: string;
  email: string;
  role: Role;
}

export interface AuthState {
  user: AuthUser | null;
  logout: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);
