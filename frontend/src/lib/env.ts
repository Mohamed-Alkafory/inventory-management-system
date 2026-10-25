/** Backend base URL. Falls back to "/api" (handy with a Vite dev proxy). */
export const API_URL: string = import.meta.env.VITE_API_URL ?? "/api";

/** Mock switch: set VITE_USE_MOCK=true to work without the backend. */
export const USE_MOCK: boolean = import.meta.env.VITE_USE_MOCK === "true";

/** OAuth client ID from Google Cloud Console (needed for "Continue with Google" with a real backend). */
export const GOOGLE_CLIENT_ID: string | undefined = import.meta.env.VITE_GOOGLE_CLIENT_ID || undefined;
