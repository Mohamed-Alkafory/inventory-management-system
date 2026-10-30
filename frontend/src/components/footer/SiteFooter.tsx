import { useLocation } from "react-router-dom";
import Footer from "./Footer";
import { isStorefrontPath } from "./storefrontPaths";

/**
 * Renders the site footer only on public storefront pages, so dashboards,
 * auth screens and account pages stay footer-free.
 */
export default function SiteFooter() {
  const { pathname } = useLocation();
  return isStorefrontPath(pathname) ? <Footer /> : null;
}
