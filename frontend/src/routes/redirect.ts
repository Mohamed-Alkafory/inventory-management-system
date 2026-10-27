import type { Location } from "react-router-dom";

export const DEFAULT_AFTER_LOGIN = "/";
export const ADMIN_AFTER_LOGIN = "/admin";

/** Where to go after signing in: the page the user was sent away from, else home (admins → admin panel). */
export function getPostLoginTarget(state: unknown, role?: string | null): string {
  const fallback = role === "ADMIN" ? ADMIN_AFTER_LOGIN : DEFAULT_AFTER_LOGIN;
  const from = (state as { from?: Partial<Location> } | null)?.from;
  const path = from?.pathname;

  if (!path || !path.startsWith("/") || path.startsWith("//") || path === "/login") {
    return fallback;
  }
  return `${path}${from?.search ?? ""}${from?.hash ?? ""}`;
}
