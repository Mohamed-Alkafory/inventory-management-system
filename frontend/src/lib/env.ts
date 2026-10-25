/**
 * Backend base URL. The Nest backend serves everything under the global prefix `/api/v1`.
 * Set VITE_API_URL in .env (e.g. http://localhost:3000/api/v1); the fallback covers local dev.
 */
export const API_URL: string =
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:3000/api/v1" : "/api/v1");

/** Mock switch: set VITE_USE_MOCK=true to work without the backend. */
export const USE_MOCK: boolean = import.meta.env.VITE_USE_MOCK === "true";

/** OAuth client ID from Google Cloud Console (needed for "Continue with Google" with a real backend). */
export const GOOGLE_CLIENT_ID: string | undefined = import.meta.env.VITE_GOOGLE_CLIENT_ID || undefined;
