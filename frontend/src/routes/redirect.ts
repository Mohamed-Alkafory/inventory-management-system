import type { Location } from "react-router-dom";
import type { Role } from "../types/auth";

/** Landing page for each role. One source of truth for menus, redirects and the 403 page. */
const ROLE_HOME: Record<Role, string> = {
  ADMIN: "/admin",
  STAFF: "/staff",
  SUPPORT: "/support",
  CUSTOMER: "/dashboard",
};

export const DEFAULT_AFTER_LOGIN = "/";
export const ADMIN_AFTER_LOGIN = ROLE_HOME.ADMIN;

/** A dashboard area: each one is a shell with its own sidebar. */
export type AppArea = "admin" | "staff" | "support" | "customer";

/** Home page of each area shell. */
export const AREA_HOME: Record<AppArea, string> = {
  admin: "/admin",
  staff: "/staff",
  support: "/support",
  customer: "/dashboard",
};

/** Home path for a signed-in role; "/" when the role is missing. */
export function homePathForRole(role?: Role | null): string {
  return role ? ROLE_HOME[role] : DEFAULT_AFTER_LOGIN;
}

/**
 * Which dashboard shell a path belongs to, or null on the public storefront.
 * Lets the global header (and shared pages) adapt to the area the user is in,
 * so links never kick them out of the dashboard they are browsing.
 */
export function areaForPath(pathname: string): AppArea | null {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/staff" || pathname.startsWith("/staff/")) return "staff";
  if (pathname === "/support" || pathname.startsWith("/support/")) return "support";
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return "customer";
  return null;
}

/** Paths that never require a role (login/register are handled separately: guests only). */
const PUBLIC_PATHS = new Set(["/", "/about", "/contact", "/forbidden"]);

/**
 * Whether `role` may open `path`. Used to decide if the "return to" location
 * captured before signing in is safe, so a user never lands on /forbidden.
 */
export function canRoleAccessPath(role: Role, path: string): boolean {
  const p = path.split("?")[0].split("#")[0];

  // Guest-only pages would immediately bounce a signed-in user again.
  if (p === "/login" || p === "/register") return false;

  // Public pages and the signed-in catalogue.
  if (PUBLIC_PATHS.has(p) || p === "/products" || p.startsWith("/products/")) return true;

  // Any signed-in role.
  if (p === "/profile" || p === "/settings" || p === "/notifications") return true;

  if (p === "/admin" || p.startsWith("/admin/")) return role === "ADMIN";
  if (p === "/staff" || p.startsWith("/staff/")) return role === "ADMIN" || role === "STAFF";
  if (p === "/support" || p.startsWith("/support/")) return role === "ADMIN" || role === "SUPPORT";
  if (p === "/dashboard" || p.startsWith("/dashboard/")) return role === "CUSTOMER";

  if (p === "/orders/new") return role === "ADMIN" || role === "STAFF";

  if (p === "/cart" || p === "/checkout" || p === "/favorites") return role === "CUSTOMER";
  if (p === "/orders" || p.startsWith("/orders/")) return role === "CUSTOMER";

  // Unknown paths render the public NotFound page, so they are safe to return to.
  return true;
}

/**
 * Where to go after signing in: the page the user was sent away from when
 * their role may open it, else the role's home (avoids redirect loops and 403 landings).
 */
export function getPostLoginTarget(state: unknown, role?: Role | null): string {
  const fallback = homePathForRole(role);
  const from = (state as { from?: Partial<Location> } | null)?.from;
  const path = from?.pathname;

  if (!path || !path.startsWith("/") || path.startsWith("//")) return fallback;
  if (!role || !canRoleAccessPath(role, path)) return fallback;

  return `${path}${from?.search ?? ""}${from?.hash ?? ""}`;
}
