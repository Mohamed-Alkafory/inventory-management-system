import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { API_URL } from "../lib/env";
import { emitSessionExpired } from "./authEvents";
import { toTokens } from "./authMappers";
import { AUTH_ENDPOINTS } from "./endpoints";
import { ApiError, toApiError } from "./errors";
import { tokenStorage } from "./tokenStorage";

const baseConfig = {
  baseURL: API_URL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
};

/** The app-wide axios instance. Always import this, never `axios` directly. */
export const http = axios.create(baseConfig);

/** Bare client for the refresh call: no interceptors, so it can never loop. */
const refreshClient = axios.create(baseConfig);

/** Login / refresh / logout failures must never trigger a refresh attempt. */
const AUTH_PATHS: string[] = [AUTH_ENDPOINTS.login, AUTH_ENDPOINTS.refresh, AUTH_ENDPOINTS.logout];
const isAuthUrl = (url?: string) => AUTH_PATHS.some((p) => url?.includes(p));

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

/* ---------- Request: attach the access token ---------- */
http.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token && !config.headers.has("Authorization")) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

/* ---------- 401: refresh once (shared by concurrent requests), then retry ---------- */
let refreshing: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) return Promise.reject(new ApiError("Session expired.", { status: 401 }));

  refreshing ??= refreshClient
    .post(AUTH_ENDPOINTS.refresh, { refreshToken })
    .then((res) => {
      const tokens = toTokens(res.data);
      tokenStorage.setTokens(tokens);
      return tokens.accessToken;
    })
    .finally(() => {
      refreshing = null;
    });

  return refreshing;
}

/* ---------- Response: refresh on 401, normalise every other error ---------- */
http.interceptors.response.use(
  (response) => response,
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

    return Promise.reject(toApiError(error));
  },
);
