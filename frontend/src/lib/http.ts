import { emitSessionExpired } from "../api/authEvents";
import { AUTH_ENDPOINTS } from "../api/endpoints";
import { refreshAccessToken } from "../api/sessionRefresh";
import { tokenStorage } from "../api/tokenStorage";
import { API_URL } from "./env";

const BASE = API_URL;

export class ApiError extends Error {
  status: number;
  /** Messages the server attached to specific fields, keyed by field name. */
  fieldErrors: Record<string, string>;
  /** The message the server sent, or null when it sent none. */
  serverMessage: string | null;
  /** The parsed response body, when the caller needs structured error details (e.g. stock failures). */
  body: unknown;

  constructor(
    status: number,
    message: string,
    opts: { fieldErrors?: Record<string, string>; serverMessage?: string | null; body?: unknown } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = opts.fieldErrors ?? {};
    this.serverMessage = opts.serverMessage ?? null;
    this.body = opts.body;
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function text(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v;
  if (Array.isArray(v)) return text(v[0]);
  if (isObject(v)) return text(v.message);
  return undefined;
}

const lastSegment = (k: unknown) => {
  const key = Array.isArray(k) ? k[0] : k;
  return typeof key === "string" ? (key.split(".").pop() ?? key) : undefined;
};

/**
 * Understands the common validation-error shapes:
 *   { errors: { name: "Already exists" } }           { errors: { name: ["Already exists"] } }
 *   { errors: [{ field: "name", message: "..." }] }  { field: "name", message: "..." }
 */
export function extractFieldErrors(body: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isObject(body)) return out;

  const bag = body.errors ?? body.details ?? body.fieldErrors;
  if (Array.isArray(bag)) {
    for (const item of bag) {
      if (!isObject(item)) continue;
      const field = lastSegment(item.field ?? item.path ?? item.param);
      const msg = text(item.message ?? item.msg);
      if (field && msg && !out[field]) out[field] = msg;
    }
  } else if (isObject(bag)) {
    for (const [k, v] of Object.entries(bag)) {
      const field = lastSegment(k);
      const msg = text(v);
      if (field && msg) out[field] = msg;
    }
  }

  const single = lastSegment(body.field);
  const singleMsg = text(body.message);
  if (single && singleMsg && !out[single]) out[single] = singleMsg;
  return out;
}

/** Login / register / refresh / logout failures must never trigger a refresh attempt. */
const AUTH_PATHS: string[] = [
  AUTH_ENDPOINTS.login,
  AUTH_ENDPOINTS.register,
  AUTH_ENDPOINTS.refresh,
  AUTH_ENDPOINTS.logout,
];
const isAuthPath = (path: string) => AUTH_PATHS.some((p) => path.startsWith(p));

type SendOptions = {
  /** Token to use instead of the stored one (post-refresh retry). */
  token?: string;
  /** Public request: never attach a token, even when the user is signed in. */
  anonymous?: boolean;
};

async function send(path: string, init: RequestInit, opts: SendOptions = {}): Promise<Response> {
  const token = opts.anonymous ? undefined : (opts.token ?? tokenStorage.getAccessToken());
  const headers = new Headers(init.headers);
  // FormData bodies must keep the browser-generated multipart boundary, so the
  // JSON Content-Type is only set for non-FormData requests.
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (opts.anonymous) {
    // Public endpoints must be callable without a session, and a stale caller
    // header must not turn the request into an authenticated one.
    headers.delete("Authorization");
  } else if (opts.token) {
    // On a post-refresh retry the fresh token must win over any stale header.
    headers.set("Authorization", `Bearer ${opts.token}`);
  } else if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    return await fetch(`${BASE}${path}`, {
      ...init,
      credentials: "include",
      headers,
    });
  } catch {
    throw new ApiError(0, "Can’t reach the server. Check your connection and try again.");
  }
}

export async function requestBlob(path: string, init: RequestInit = {}): Promise<Response> {
  const hadSession = Boolean(tokenStorage.getAccessToken());
  let res = await send(path, init);

  // Same one-shot refresh as `request`, but the body is never parsed: callers
  // need the raw response (CSV downloads read headers and then `blob()`).
  if (res.status === 401 && !isAuthPath(path)) {
    if (tokenStorage.getRefreshToken()) {
      try {
        const token = await refreshAccessToken();
        res = await send(path, init, { token });
      } catch {
        // Refresh failed - fall through to sign the user out.
      }
    }

    if (res.status === 401 && hadSession) {
      tokenStorage.clear();
      emitSessionExpired();
    }
  }

  if (!res.ok) {
    const raw = await res.text();
    let body: unknown = null;
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = null;
      }
    }
    const serverMessage = isObject(body) ? (text(body.message) ?? text(body.error) ?? null) : null;
    const helpful = serverMessage === "Internal Server Error" ? null : serverMessage;
    throw new ApiError(res.status, helpful ?? `Request failed (${res.status})`, {
      fieldErrors: extractFieldErrors(body),
      serverMessage,
      body,
    });
  }
  return res;
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const hadSession = Boolean(tokenStorage.getAccessToken());
  let res = await send(path, init);

  // Expired access token: refresh once (shared with the axios client, so a
  // rotating refresh token is never presented twice) and replay the request.
  if (res.status === 401 && !isAuthPath(path)) {
    if (tokenStorage.getRefreshToken()) {
      try {
        const token = await refreshAccessToken();
        res = await send(path, init, { token });
      } catch {
        // Refresh failed — fall through to sign the user out.
      }
    }

    if (res.status === 401 && hadSession) {
      tokenStorage.clear();
      emitSessionExpired();
    }
  }

  const raw = await res.text();
  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const serverMessage = isObject(body) ? (text(body.message) ?? text(body.error) ?? null) : null;
    // A bare "Internal Server Error" alone doesn't help the user — fall back to it
    // only when we have nothing better to say.
    const helpful = serverMessage === "Internal Server Error" ? null : serverMessage;
    throw new ApiError(res.status, helpful ?? `Request failed (${res.status})`, {
      fieldErrors: extractFieldErrors(body),
      serverMessage,
      body,
    });
  }
  return body as T;
}

/**
 * Request for a public endpoint (e.g. `POST /contact`).
 *
 * Unlike `request`, it never attaches the stored token, never refreshes an
 * expired session and never emits `session-expired` — anonymous visitors must
 * be able to submit without being redirected to login.
 */
export async function publicRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await send(path, init, { anonymous: true });

  const raw = await res.text();
  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const serverMessage = isObject(body) ? (text(body.message) ?? text(body.error) ?? null) : null;
    const helpful = serverMessage === "Internal Server Error" ? null : serverMessage;
    throw new ApiError(res.status, helpful ?? `Request failed (${res.status})`, {
      fieldErrors: extractFieldErrors(body),
      serverMessage,
      body,
    });
  }
  return body as T;
}
