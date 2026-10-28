import { API_URL } from "./env";

const ABSOLUTE_HTTP = /^https?:\/\//i;

/** Origin of an absolute API URL, or null when the API URL is relative (dev proxy). */
function backendOrigin(apiUrl: string): string | null {
  if (!ABSOLUTE_HTTP.test(apiUrl)) return null;
  try {
    return new URL(apiUrl).origin;
  } catch {
    return null;
  }
}

/**
 * Turns the `imageUrl` stored on a product into something an `<img src>` can use.
 *
 * - Empty / missing → `null` (callers show their own placeholder).
 * - External `http(s)` URLs (and other schemes like `blob:`) → returned unchanged.
 * - Backend-relative paths such as `/uploads/products/<uuid>.webp` → prefixed
 *   with the backend **origin**. The `/api/v1` prefix is not part of these URLs;
 *   they are served at the server root.
 * - When `VITE_API_URL` is relative (development through the Vite proxy), the
 *   path is kept relative so the same proxy serves the images.
 *
 * `apiUrl` is injectable for tests; production callers use the configured value.
 */
export function resolveImageUrl(imageUrl?: string | null, apiUrl: string = API_URL): string | null {
  const value = imageUrl?.trim();
  if (!value) return null;

  // Already absolute (https://..., blob:..., data:...) or protocol-relative (//cdn...).
  if (ABSOLUTE_HTTP.test(value) || value.startsWith("//")) return value;
  if (!value.startsWith("/")) return value;

  const origin = backendOrigin(apiUrl);
  return origin ? `${origin}${value}` : value;
}
