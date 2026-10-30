import { Navigate, useLocation, useParams } from "react-router-dom";

/**
 * Redirects an old top-level URL to its new home, filling `:param`
 * placeholders from the current route (e.g. `/orders/:id` → `/dashboard/orders/:id`).
 * Query string and hash are preserved.
 */
export default function LegacyRedirect({ to }: { to: string }) {
  const params = useParams();
  const { search, hash } = useLocation();
  const path = to.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => params[key] ?? "");
  return <Navigate to={`${path}${search}${hash}`} replace />;
}
