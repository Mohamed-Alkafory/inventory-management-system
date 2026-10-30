/** Public storefront paths that show the marketing footer. */
const STOREFRONT_PATHS = new Set(["/", "/about", "/contact", "/products"]);

/** Whether the footer should render for a pathname. */
export function isStorefrontPath(pathname: string): boolean {
  const path = pathname.split("?")[0].split("#")[0];
  return STOREFRONT_PATHS.has(path) || path.startsWith("/products/");
}
