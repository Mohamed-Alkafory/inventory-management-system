/**
 * Backend base URL. The Nest backend serves everything under the global prefix `/api/v1`.
 *
 * Development uses Vite's `/api` proxy (see `vite.config.ts`), so the default is
 * a relative URL and requests stay same-origin. Set `VITE_API_URL` when the API
 * is deployed on another origin, or for a production deployment without a proxy.
 */
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

export const API_URL: string = configuredApiUrl || "/api/v1";

/** Mock switch: set VITE_USE_MOCK=true to work without the backend. */
export const USE_MOCK: boolean = import.meta.env.VITE_USE_MOCK === "true";


if (import.meta.env.DEV && !USE_MOCK) {
  // One-line hint in the dev console so a wrong API target is obvious.
  console.info(`[env] API_URL = ${API_URL}${configuredApiUrl ? " (from VITE_API_URL)" : " (default → needs the Vite /api proxy)"}`);
}
