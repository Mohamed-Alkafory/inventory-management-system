import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import {
  MAX_RETRIES,
  REQUEST_TIMEOUT_MS,
  beginApiRequest,
  beginRetry,
  isRetryableMethod,
  isRetryableStatus,
  retryDelayMs,
  sleep,
} from "../lib/coldStart";
import { API_URL } from "../lib/env";
import { emitSessionExpired } from "./authEvents";
import { AUTH_ENDPOINTS } from "./endpoints";
import { toApiError } from "./errors";
import { refreshAccessToken } from "./sessionRefresh";
import { tokenStorage } from "./tokenStorage";

const baseConfig = {
  baseURL: API_URL,
  // Free hosts can sleep; the first request after a nap may take a minute.
  timeout: REQUEST_TIMEOUT_MS,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
};

/** The app-wide axios instance. Always import this, never `axios` directly. */
export const http = axios.create(baseConfig);

/** Login / register / refresh / logout failures must never trigger a refresh attempt. */
const AUTH_PATHS: string[] = [
  AUTH_ENDPOINTS.login,
  AUTH_ENDPOINTS.register,
  AUTH_ENDPOINTS.refresh,
  AUTH_ENDPOINTS.logout,
];
const isAuthUrl = (url?: string) => AUTH_PATHS.some((p) => url?.includes(p));

type RetriableConfig = InternalAxiosRequestConfig & {
  /** Set once after the 401 refresh replay. */
  _retried?: boolean;
  /** Number of automatic retries already used for this request. */
  _attempt?: number;
  /** Ends the shared "waking up" tracking for this request. */
  _endColdStart?: () => void;
};

function finishColdStart(config: RetriableConfig): void {
  config._endColdStart?.();
  config._endColdStart = undefined;
}

/** Network errors, timeouts and 502/503/504 on GET/HEAD are retryable. */
function isRetryableError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;

  const config = error.config;
  if (!isRetryableMethod(config?.method)) return false;
  if (error.response) return isRetryableStatus(error.response.status);

  // No response at all: DNS/network failure or the 45s timeout. A caller
  // cancellation is not a cold start and must never be retried.
  return error.code !== "ERR_CANCELED";
}

/* ---------- Request: attach the access token and start slow-request tracking ---------- */
http.interceptors.request.use((config) => {
  // FormData must be sent as multipart/form-data so the browser can add the
  // boundary itself — the instance-wide JSON default would break the upload.
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    config.headers.delete("Content-Type");
  }

  const token = tokenStorage.getAccessToken();
  if (token && !config.headers.has("Authorization")) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  const tracked = config as RetriableConfig;
  // Retries re-run this interceptor; keep the original tracking window.
  if (!tracked._endColdStart) {
    tracked._endColdStart = beginApiRequest(`${config.baseURL ?? ""}${config.url ?? ""}`);
  }

  return config;
});

/* ---------- Response: refresh on 401 (once, shared by concurrent requests), then retry ---------- */
http.interceptors.response.use(
  (response) => {
    finishColdStart(response.config as RetriableConfig);
    return response;
  },
  async (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401 && error.config && !isAuthUrl(error.config.url)) {
      const original = error.config as RetriableConfig;
      const hadSession = Boolean(tokenStorage.getAccessToken());

      if (!original._retried && tokenStorage.getRefreshToken()) {
        original._retried = true;
        try {
          const token = await refreshAccessToken();
          original.headers.set("Authorization", `Bearer ${token}`);
          return await http(original);
        } catch {
          // Refresh failed — fall through to sign the user out.
        }
      }

      if (hadSession) {
        tokenStorage.clear();
        emitSessionExpired();
      }
    }

    if (axios.isAxiosError(error) && error.config) {
      const original = error.config as RetriableConfig;
      const attempt = original._attempt ?? 0;

      if (isRetryableError(error) && attempt < MAX_RETRIES) {
        original._attempt = attempt + 1;
        // The backoff pause counts as "waking up" even before 3 seconds pass.
        const endRetry = beginRetry();
        try {
          await sleep(retryDelayMs(attempt));
        } finally {
          endRetry();
        }
        return http(original);
      }

      finishColdStart(original);
    }

    return Promise.reject(toApiError(error));
  },
);
