/** Backend base URL. Falls back to "/api" (handy with a Vite dev proxy). */
export const API_URL: string = import.meta.env.VITE_API_URL ?? "/api";

/** Mock switch: set VITE_USE_MOCK=true to work without the backend. */
export const USE_MOCK: boolean = import.meta.env.VITE_USE_MOCK === "true";
