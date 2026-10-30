/** Every role the backend knows, in display order. Use this list for filters, selects and labels. */
export const ROLES = ["ADMIN", "STAFF", "SUPPORT", "CUSTOMER"] as const;

export type Role = (typeof ROLES)[number];

/** Human label for each role (badges, selects, menus). */
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  STAFF: "Staff",
  SUPPORT: "Support",
  CUSTOMER: "Customer",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Backend-relative `/uploads/avatars/...` path, an external URL, or null. */
  avatarUrl?: string | null;
  /** Present when the backend echoes it (GET /auth/me). Optional elsewhere. */
  createdAt?: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
};

export type UpdateProfilePayload = {
  /** New display name (min 2, max 100). */
  name?: string;
  /** To change the password the current one must be proven. */
  password?: {
    current: string;
    next: string;
  };
};

export type AuthTokens = {
  accessToken: string;
  /** Optional: absent when the backend refreshes through an httpOnly cookie. */
  refreshToken?: string;
};

export type AuthSession = {
  user: User;
  tokens: AuthTokens;
};
