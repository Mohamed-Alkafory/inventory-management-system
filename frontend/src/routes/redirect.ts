import type { Location } from "react-router-dom";

export const DEFAULT_AFTER_LOGIN = "/";

/** Where to go after signing in: the page the user was sent away from, else the home page. */
export function getPostLoginTarget(state: unknown): string {
  const from = (state as { from?: Partial<Location> } | null)?.from;
  const path = from?.pathname;

  if (!path || !path.startsWith("/") || path.startsWith("//") || path === "/login") {
    return DEFAULT_AFTER_LOGIN;
  }
  return `${path}${from?.search ?? ""}${from?.hash ?? ""}`;
}
