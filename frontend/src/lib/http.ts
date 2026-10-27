import { tokenStorage } from "../api/tokenStorage";
import { API_URL } from "./env";

const BASE = API_URL;

export class ApiError extends Error {
  status: number;
  /** Messages the server attached to specific fields, keyed by field name. */
  fieldErrors: Record<string, string>;
  /** The message the server sent, or null when it sent none. */
  serverMessage: string | null;

  constructor(
    status: number,
    message: string,
    opts: { fieldErrors?: Record<string, string>; serverMessage?: string | null } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = opts.fieldErrors ?? {};
    this.serverMessage = opts.serverMessage ?? null;
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

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStorage.getAccessToken();
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: "include",
      headers,
    });
  } catch {
    throw new ApiError(0, "Can’t reach the server. Check your connection and try again.");
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
    });
  }
  return body as T;
}
