export type Role = "ADMIN" | "STAFF";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
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

export type AuthTokens = {
  accessToken: string;
  /** Optional: absent when the backend refreshes through an httpOnly cookie. */
  refreshToken?: string;
};

export type AuthSession = {
  user: User;
  tokens: AuthTokens;
};
