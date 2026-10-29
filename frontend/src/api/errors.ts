import axios from "axios";

type ApiErrorInit = {
  status?: number | null;
  code?: string;
  details?: unknown;
  isNetworkError?: boolean;
};

/** The one error type the UI ever has to handle. */
export class ApiError extends Error {
  status: number | null;
  code?: string;
  details?: unknown;
  isNetworkError: boolean;

  constructor(message: string, init: ApiErrorInit = {}) {
    super(message);
    this.name = "ApiError";
    this.status = init.status ?? null;
    this.code = init.code;
    this.details = init.details;
    this.isNetworkError = init.isNetworkError ?? false;
  }
}

function defaultMessage(status: number): string {
  if (status === 400) return "The request was invalid.";
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "We couldn't find what you were looking for.";
  if (status === 409) return "This conflicts with existing data.";
  if (status === 413) return "The file is too large.";
  if (status === 422) return "Some of the submitted values are not valid.";
  if (status === 429) return "Too many requests. Please slow down and try again.";
  if (status >= 500) return "The server ran into a problem. Please try again shortly.";
  return "Something went wrong.";
}

/** Turns anything thrown by axios (or elsewhere) into an ApiError. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isAxiosError(error)) {
    if (!error.response) {
      const timedOut = error.code === "ECONNABORTED";
      const base = error.config?.baseURL ?? "";
      const target = `${base}${error.config?.url ?? ""}`;
      const absolute = /^https?:\/\//i.test(base) ? base : `${window.location.origin}${base}`;

      // No HTTP response at all: backend down, wrong URL/port, blocked by CORS, or the dev proxy is missing.
      // The browser hides which one, so surface the exact URL we tried to reach to make it diagnosable.
      if (import.meta.env.DEV) {
        console.error(
          `[api] No response from ${error.config?.method?.toUpperCase() ?? "request"} ${target} (${error.code ?? "unknown"}).\n` +
            `Resolved API base: ${absolute}\n` +
            "Check: 1) the backend is running  2) VITE_API_URL / the Vite proxy points at it  " +
            "3) the backend allows this origin (CORS) — see the Network tab for the real reason.",
          error,
        );
      }

      const message = timedOut
        ? "The request timed out. Please try again."
        : import.meta.env.DEV
          ? `Can't reach the server at ${absolute}. Make sure the backend is running and the API URL is correct.`
          : "Can't reach the server. Check your connection and try again.";

      return new ApiError(message, { isNetworkError: true, code: error.code });
    }

    const { status, data } = error.response;
    const body = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
    // Nest sends `message` as a string, or as a string[] for validation errors.
    let serverMessage = Array.isArray(body.message)
      ? body.message.filter((m): m is string => typeof m === "string").join(" · ") || undefined
      : typeof body.message === "string"
        ? body.message
        : typeof body.error === "string"
          ? body.error
          : undefined;

    // A bare "Internal Server Error" tells the user nothing useful — prefer the status-based hint.
    if (serverMessage === "Internal Server Error") serverMessage = undefined;

    return new ApiError(serverMessage ?? defaultMessage(status), {
      status,
      code: typeof body.code === "string" ? body.code : typeof body.error === "string" ? body.error : undefined,
      details: body.fieldErrors ?? body.errors,
    });
  }

  return new ApiError(error instanceof Error ? error.message : "Something went wrong.");
}
