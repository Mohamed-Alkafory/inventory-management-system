import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_RETRIES,
  RETRY_DELAYS_MS,
  SLOW_REQUEST_THRESHOLD_MS,
  beginApiRequest,
  beginRetry,
  getSlowRequestState,
  isApiUrl,
  isRetryableMethod,
  isRetryableStatus,
  resetColdStart,
  retryDelayMs,
} from "./coldStart";

const apiUrl = () => `${window.location.origin}/api/v1/products`;

beforeEach(() => {
  vi.useFakeTimers();
  resetColdStart();
});

afterEach(() => {
  resetColdStart();
  vi.useRealTimers();
});

describe("cold-start policy", () => {
  it("retries only idempotent reads", () => {
    expect(isRetryableMethod(undefined)).toBe(true);
    expect(isRetryableMethod("GET")).toBe(true);
    expect(isRetryableMethod("head")).toBe(true);
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      expect(isRetryableMethod(method)).toBe(false);
    }
  });

  it("retries only 502, 503 and 504", () => {
    for (const status of [502, 503, 504]) expect(isRetryableStatus(status)).toBe(true);
    for (const status of [400, 401, 403, 404, 409, 422, 429, 500]) {
      expect(isRetryableStatus(status)).toBe(false);
    }
    expect(isRetryableStatus(null)).toBe(false);
  });

  it("uses 1s then 3s backoff for exactly two retries", () => {
    expect(MAX_RETRIES).toBe(2);
    expect(retryDelayMs(0)).toBe(RETRY_DELAYS_MS[0]);
    expect(retryDelayMs(1)).toBe(RETRY_DELAYS_MS[1]);
  });

  it("tracks only the configured API origin", () => {
    expect(isApiUrl(apiUrl())).toBe(true);
    expect(isApiUrl("/api/v1/products")).toBe(true);
    expect(isApiUrl("https://res.cloudinary.com/demo/image.png")).toBe(false);
    expect(isApiUrl(null)).toBe(false);
  });

  it("reports a request as waking only after 3 seconds", async () => {
    const end = beginApiRequest(apiUrl());
    expect(getSlowRequestState()).toEqual({ waking: false, pending: 1 });

    await vi.advanceTimersByTimeAsync(SLOW_REQUEST_THRESHOLD_MS - 1);
    expect(getSlowRequestState().waking).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(getSlowRequestState().waking).toBe(true);

    end();
    expect(getSlowRequestState()).toEqual({ waking: false, pending: 0 });
  });

  it("shows the wake-up state as soon as a retry is scheduled", async () => {
    const endRequest = beginApiRequest(apiUrl());
    const endRetry = beginRetry();

    expect(getSlowRequestState().waking).toBe(true);

    endRetry();
    expect(getSlowRequestState().waking).toBe(false);

    endRequest();
    expect(getSlowRequestState().pending).toBe(0);
  });

  it("ignores requests to external hosts", async () => {
    const end = beginApiRequest("https://example.com/data");
    expect(getSlowRequestState()).toEqual({ waking: false, pending: 0 });

    await vi.advanceTimersByTimeAsync(SLOW_REQUEST_THRESHOLD_MS);
    expect(getSlowRequestState().waking).toBe(false);
    end();
  });

  it("is idempotent when a request is ended twice", async () => {
    const end = beginApiRequest(apiUrl());
    end();
    end();

    expect(getSlowRequestState()).toEqual({ waking: false, pending: 0 });
  });
});
