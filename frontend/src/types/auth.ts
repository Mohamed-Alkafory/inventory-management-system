export type Role = "ADMIN" | "STAFF";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
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

export type ChangePasswordPayload = {
  /** The current password, to prove it is really the owner asking. */
  currentPassword: string;
  /** At least 8 characters — hashed and stored; all refresh tokens are revoked. */
  newPassword: string;
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
