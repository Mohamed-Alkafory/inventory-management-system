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
      return new ApiError(
        error.code === "ECONNABORTED"
          ? "The request timed out. Please try again."
          : "Can't reach the server. Check your connection and try again.",
        { isNetworkError: true },
      );
    }

    const { status, data } = error.response;
    const body = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
    const serverMessage =
      typeof body.message === "string" ? body.message : typeof body.error === "string" ? body.error : undefined;

    return new ApiError(serverMessage ?? defaultMessage(status), {
      status,
      code: typeof body.code === "string" ? body.code : undefined,
      details: body.errors,
    });
  }

  return new ApiError(error instanceof Error ? error.message : "Something went wrong.");
}
