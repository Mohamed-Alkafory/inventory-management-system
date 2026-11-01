import { API_URL } from "./env";

/**
 * Shared cold-start policy for both HTTP clients (`lib/http.ts` fetch client
 * and `api/http.ts` axios client).
 *
 * The backend runs on a free host that sleeps after inactivity, so the first
 * request after a nap can take up to about a minute. Every API request gets:
 *   - a 45 second per-attempt timeout,
 *   - at most two retries for idempotent reads on network errors, timeouts and
 *     502/503/504 responses,
 *   - a shared "server is waking up" signal used by `ColdStartBanner`.
 *
 * Mutations (POST/PATCH/PUT/DELETE) are never retried, so an order or a form
 * submit can never be sent twice.
 */

/** Per-attempt timeout for every API request. */
export const REQUEST_TIMEOUT_MS = 45_000;

/** A request pending for longer than this counts as "the server is waking up". */
export const SLOW_REQUEST_THRESHOLD_MS = 3_000;

/** Delays before retry 1 and retry 2. */
export const RETRY_DELAYS_MS = [1_000, 3_000] as const;

/** Maximum automatic retries (two) for idempotent reads. */
export const MAX_RETRIES = RETRY_DELAYS_MS.length;

/** Final messages used when every attempt failed. */
export const TIMEOUT_MESSAGE = "The server took too long to respond. Please try again.";
export const UNAVAILABLE_MESSAGE =
  "The server is taking longer than usual to respond. Please try again in a moment.";

const RETRYABLE_STATUSES = new Set([502, 503, 504]);
const RETRYABLE_METHODS = new Set(["GET", "HEAD"]);

/** Uppercases the method, defaulting to GET (the fetch API's default). */
export function normalizeMethod(method?: string | null): string {
  return (method ?? "GET").toUpperCase();
}

/** Only idempotent reads may be replayed automatically. */
export function isRetryableMethod(method?: string | null): boolean {
  return RETRYABLE_METHODS.has(normalizeMethod(method));
}

/** 502/503/504 mean a gateway or sleeping host, not a user-facing mistake. */
export function isRetryableStatus(status?: number | null): boolean {
  return typeof status === "number" && RETRYABLE_STATUSES.has(status);
}

/** Backoff for retry `attempt` (0-based): 1s, then 3s. */
export function retryDelayMs(attempt: number): number {
  const index = Math.max(0, Math.min(attempt, RETRY_DELAYS_MS.length - 1));
  return RETRY_DELAYS_MS[index];
}

/** Promise-based pause used by both clients between attempts. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function currentOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "http://localhost";
}

/**
 * True when `url` targets the configured API origin. Requests to external
 * hosts (e.g. images or a third-party service) never trigger the banner.
 */
export function isApiUrl(url?: string | null): boolean {
  if (!url) return false;

  try {
    const target = new URL(url, currentOrigin());
    const api = new URL(API_URL, currentOrigin());
    return target.origin === api.origin;
  } catch {
    return false;
  }
}

export type ColdStartState = {
  /** True while a request is slow or a retry is scheduled. */
  waking: boolean;
  /** Number of tracked API requests currently in flight. */
  pending: number;
};

let pendingRequests = 0;
let activeRetries = 0;
let slowRequest = false;
let slowTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

let snapshot: ColdStartState = { waking: false, pending: 0 };

function emit(): void {
  const waking = slowRequest || activeRetries > 0;
  if (snapshot.waking === waking && snapshot.pending === pendingRequests) return;

  snapshot = { waking, pending: pendingRequests };
  for (const listener of listeners) listener();
}

function clearSlowTimer(): void {
  if (slowTimer !== null) {
    clearTimeout(slowTimer);
    slowTimer = null;
  }
}

/**
 * Starts tracking one API request. Returns an idempotent function that must be
 * called when the request finally settles (after all retries).
 */
export function beginApiRequest(url?: string | null): () => void {
  if (!isApiUrl(url)) return () => {};

  pendingRequests += 1;

  if (pendingRequests === 1) {
    clearSlowTimer();
    slowRequest = false;
    slowTimer = setTimeout(() => {
      slowTimer = null;
      slowRequest = true;
      emit();
    }, SLOW_REQUEST_THRESHOLD_MS);
  }

  emit();

  let ended = false;
  return () => {
    if (ended) return;
    ended = true;

    pendingRequests = Math.max(0, pendingRequests - 1);
    if (pendingRequests === 0) {
      clearSlowTimer();
      slowRequest = false;
      // A retry cannot outlive its request, but reset defensively so a missed
      // `end` can never leave the banner stuck on screen.
      activeRetries = 0;
    }
    emit();
  };
}

/** Marks the backoff pause before a retry so the banner shows immediately. */
export function beginRetry(): () => void {
  activeRetries += 1;
  emit();

  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    activeRetries = Math.max(0, activeRetries - 1);
    emit();
  };
}

/** Subscription for `useSyncExternalStore`. */
export function subscribeSlowRequests(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Stable snapshot for `useSyncExternalStore`: the object only changes when the
 * reported values change.
 */
export function getSlowRequestState(): ColdStartState {
  return snapshot;
}

/** Test helper: forget all in-flight requests without notifying subscribers. */
export function resetColdStart(): void {
  clearSlowTimer();
  pendingRequests = 0;
  activeRetries = 0;
  slowRequest = false;
  snapshot = { waking: false, pending: 0 };
}
