import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { API_URL } from "../lib/env";
import { emitSessionExpired } from "./authEvents";
import { AUTH_ENDPOINTS } from "./endpoints";
import { toApiError } from "./errors";
import { refreshAccessToken } from "./sessionRefresh";
import { tokenStorage } from "./tokenStorage";

const baseConfig = {
  baseURL: API_URL,
  timeout: 15_000,
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

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

/* ---------- Request: attach the access token ---------- */
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
  return config;
});

/* ---------- Response: refresh on 401 (once, shared by concurrent requests), then retry ---------- */
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
