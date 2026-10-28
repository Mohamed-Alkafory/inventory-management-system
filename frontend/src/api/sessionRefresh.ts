import { API_URL } from "../lib/env";
import { AUTH_ENDPOINTS } from "./endpoints";
import { toTokens } from "./authMappers";
import { ApiError } from "./errors";
import { tokenStorage } from "./tokenStorage";

/*
  One refresh path for the whole app.

  There are two HTTP clients (axios in api/http.ts and fetch in lib/http.ts),
  and the backend rotates refresh tokens with single-use semantics. If each
  client refreshed on its own, concurrent 401s would race: one rotation wins
  and the other presents an already-revoked token, signing the user out.

  This module keeps a single in-flight refresh promise so every caller joins
  the same rotation. It uses bare `fetch` (no interceptors) so it can never
  recurse, and it only stores the new tokens through `tokenStorage`.
*/

let refreshing: Promise<string> | null = null;

async function postRefresh(refreshToken: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${AUTH_ENDPOINTS.refresh}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    throw new ApiError("Can’t reach the server. Check your connection and try again.", { isNetworkError: true });
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

  if (!res.ok) throw new ApiError("Session expired.", { status: res.status, details: body });

  const tokens = toTokens(body);
  tokenStorage.setTokens(tokens);
  return tokens.accessToken;
}

/**
 * Exchanges the stored refresh token for a fresh access token.
 * Concurrent callers share one request. Rejects when there is no refresh
 * token or the backend refuses the rotation.
 */
export function refreshAccessToken(): Promise<string> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) return Promise.reject(new ApiError("Session expired.", { status: 401 }));

  refreshing ??= postRefresh(refreshToken).finally(() => {
    refreshing = null;
  });

  return refreshing;
}
