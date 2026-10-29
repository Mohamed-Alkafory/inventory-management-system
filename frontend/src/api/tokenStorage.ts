import type { AuthTokens, User } from "../types/auth";
import { toRole } from "./authMappers";

/*
  Persists the session in localStorage so a refresh keeps the user signed in.
  Trade-off: localStorage is readable by any script on the page (XSS). If the
  backend can issue the refresh token as an httpOnly cookie, keep only the
  short-lived access token here.
*/

const KEY = "prodexa.auth.v1";

export type StoredSession = AuthTokens & { user: User };

function read(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const s = parsed as Record<string, unknown>;
    const u = s.user as Record<string, unknown> | undefined;

    if (typeof s.accessToken !== "string" || !u || typeof u.id !== "string" || typeof u.email !== "string") {
      return null;
    }

    return {
      accessToken: s.accessToken,
      refreshToken: typeof s.refreshToken === "string" ? s.refreshToken : undefined,
      user: {
        id: u.id,
        email: u.email,
        name: typeof u.name === "string" ? u.name : u.email,
        role: toRole(u.role),
        ...(typeof u.avatarUrl === "string" || u.avatarUrl === null ? { avatarUrl: u.avatarUrl } : {}),
        ...(typeof u.createdAt === "string" ? { createdAt: u.createdAt } : {}),
      },
    };
  } catch {
    return null;
  }
}

function write(session: StoredSession | null) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage can be unavailable (private mode / quota) — the session just won't persist.
  }
}

export const tokenStorage = {
  KEY,
  getSession: read,
  setSession: (session: StoredSession) => write(session),
  getAccessToken: () => read()?.accessToken ?? null,
  getRefreshToken: () => read()?.refreshToken ?? null,
  /** Replaces tokens after a refresh, keeping the stored user. */
  setTokens(tokens: AuthTokens) {
    const current = read();
    if (current) write({ ...current, ...tokens, refreshToken: tokens.refreshToken ?? current.refreshToken });
  },
  setUser(user: User) {
    const current = read();
    if (current) write({ ...current, user });
  },
  clear: () => write(null),
};
