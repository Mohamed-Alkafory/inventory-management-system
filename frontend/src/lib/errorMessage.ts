import { ApiError } from "./http";

/** The best message for a failed request, preferring Nest's own validation text. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.serverMessage ?? error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
