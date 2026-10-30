import { ApiError } from "../../lib/http";

/**
 * One place for user-facing catalogue errors: 404 (inactive/unknown product),
 * 429 (public rate limit) and network failures get clearer wording.
 */
export function catalogErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return "This product is no longer available.";
    if (error.status === 429) return "Too many requests — please try again in a moment.";
    if (error.status === 0) return "Can't reach the server. Check your connection and try again.";
    return error.message;
  }
  return "Please try again in a moment.";
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
