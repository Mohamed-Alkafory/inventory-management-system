import { useLocation } from "react-router-dom";
import { useAuth } from "../context/auth/useAuth";
import type { Role } from "../types/auth";
import { AREA_HOME, areaForPath, homePathForRole } from "./redirect";
import type { AppArea } from "./redirect";

export type AreaLinks = {
  /** Dashboard shell the current path belongs to, or null on the storefront. */
  area: AppArea | null;
  /** Base path of the dashboard a signed-in user should stay in, or null for guests. */
  base: string | null;
  isAuthenticated: boolean;
  role: Role | null;
  products: string;
  profile: string;
  orders: string;
  favorites: string;
  cart: string;
  checkout: string;
  settings: string;
  notifications: string;
  /** The signed-in user's dashboard home (null for guests). */
  dashboard: string | null;
};

/**
 * Auth-aware links for the global chrome (header and footer).
 *
 * Signed-in users always stay inside a dashboard: the area they are currently
 * browsing when there is one, otherwise their role's home. Guests get the
 * public storefront routes instead.
 */
export function useAreaLinks(): AreaLinks {
  const { pathname } = useLocation();
  const { isAuthenticated, role } = useAuth();

  const area = areaForPath(pathname);
  const base = area ? AREA_HOME[area] : isAuthenticated && role ? homePathForRole(role) : null;

  const at = (segment: string, fallback: string) => (base ? `${base}/${segment}` : fallback);

  return {
    area,
    base,
    isAuthenticated,
    role,
    products: at("products", "/products"),
    profile: at("profile", "/profile"),
    orders: at("orders", "/orders"),
    favorites: at("favorites", "/favorites"),
    cart: at("cart", "/cart"),
    checkout: at("checkout", "/checkout"),
    settings: at("settings", "/settings"),
    notifications: at("notifications", "/notifications"),
    dashboard: base,
  };
}