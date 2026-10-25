/*
  Auth endpoints — the only place that knows the backend paths.
  When the real auth API is merged, adjust these (and api/authMappers.ts) if they differ.
*/
export const AUTH_ENDPOINTS = {
  login: "/auth/login",
  register: "/auth/register",
  google: "/auth/google",
  refresh: "/auth/refresh",
  logout: "/auth/logout",
  me: "/auth/me",
} as const;
