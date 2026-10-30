import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { authApi } from "../../api/authApi";
import { onSessionExpired } from "../../api/authEvents";
import { queryClient } from "../../api/queryClient";
import { tokenStorage } from "../../api/tokenStorage";
import { ToastContext } from "../../components/ui/toast/toast-context";
import type { AuthSession, LoginPayload, RegisterPayload, Role, UpdateProfilePayload, User } from "../../types/auth";
import { AuthContext } from "./auth-context";
import type { AuthContextValue } from "./auth-context";

export default function AuthProvider({ children }: { children: ReactNode }) {
  // Optional toast: the provider still works (silently) outside a ToastProvider.
  const toast = useContext(ToastContext);

  // Start from the stored session so a page refresh never flashes the login screen.
  const [user, setUser] = useState<User | null>(() => tokenStorage.getSession()?.user ?? null);

  /* Re-validate the stored session once; a 401 here is handled by the axios layer. */
  useEffect(() => {
    if (!tokenStorage.getAccessToken()) return;

    let cancelled = false;
    authApi
      .me()
      .then((fresh) => {
        if (cancelled) return;
        tokenStorage.setUser(fresh);
        setUser(fresh);
      })
      .catch(() => {
        // 401 → axios already cleared the session and emitted "expired".
        // Network/server errors keep the cached session; the next request will retry.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /* Token refresh failed / 401 with no way back → sign out everywhere in the UI. */
  useEffect(
    () =>
      onSessionExpired(() => {
        queryClient.clear();
        setUser(null);
        toast?.warning("Session expired", "Please sign in again to continue.");
      }),
    [toast],
  );

  /* Keep several tabs in sync (login/logout in one tab shows up in the others). */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== tokenStorage.KEY) return;
      setUser(tokenStorage.getSession()?.user ?? null);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const startSession = useCallback(({ user: signedIn, tokens }: AuthSession) => {
    tokenStorage.setSession({ ...tokens, user: signedIn });
    setUser(signedIn);
    return signedIn;
  }, []);

  const login = useCallback(async (payload: LoginPayload) => startSession(await authApi.login(payload)), [startSession]);

  const register = useCallback(
    async (payload: RegisterPayload) => startSession(await authApi.register(payload)),
    [startSession],
  );

  /** PATCH /auth/me — persists the fresh user into the session. */
  const updateProfile = useCallback(async (payload: UpdateProfilePayload) => {
    const fresh = await authApi.updateProfile(payload);
    tokenStorage.setUser(fresh);
    setUser(fresh);
    return fresh;
  }, []);

  /** POST /users/me/avatar — the response is the updated current user. */
  const uploadAvatar = useCallback(async (file: File) => {
    const fresh = await authApi.uploadAvatar(file);
    tokenStorage.setUser(fresh);
    setUser(fresh);
    return fresh;
  }, []);

  /** DELETE /users/me/avatar — 204, so clear the avatar locally. */
  const removeAvatar = useCallback(async () => {
    await authApi.removeAvatar();
    const stored = tokenStorage.getSession()?.user;
    if (stored) tokenStorage.setUser({ ...stored, avatarUrl: null });
    setUser((prev) => (prev ? { ...prev, avatarUrl: null } : prev));
  }, []);

  /** DELETE /auth/me — deactivates the account, then signs out locally. */
  const deleteAccount = useCallback(async () => {
    try {
      await authApi.deleteAccount();
    } finally {
      tokenStorage.clear();
      queryClient.clear();
      setUser(null);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout(); // best effort — we sign out locally either way
    } catch {
      /* ignore */
    }
    tokenStorage.clear();
    queryClient.clear();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role ?? null,
      isAuthenticated: user !== null,
      login,
      register,
      updateProfile,
      uploadAvatar,
      removeAvatar,
      deleteAccount,
      logout,
      hasRole: (...roles: Role[]) => (user ? roles.includes(user.role) : false),
    }),
    [user, login, register, updateProfile, uploadAvatar, removeAvatar, deleteAccount, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
