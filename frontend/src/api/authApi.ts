import type { AuthSession, LoginPayload, RegisterPayload, User } from "../types/auth";
import { toAuthSession, toUser } from "./authMappers";
import { AUTH_ENDPOINTS } from "./endpoints";
import { http } from "./http";
import { mockAuthApi } from "./mock/authMock";
import { withMock } from "./mockSwitch";
import { tokenStorage } from "./tokenStorage";

export type AuthApi = {
  login(payload: LoginPayload): Promise<AuthSession>;
  /** Creates an account and signs it in. */
  register(payload: RegisterPayload): Promise<AuthSession>;
  /** Exchanges a Google ID token (credential) for an app session. */
  loginWithGoogle(idToken: string): Promise<AuthSession>;
  me(): Promise<User>;
  logout(): Promise<void>;
};

const realAuthApi: AuthApi = {
  async login(payload) {
    const { data } = await http.post(AUTH_ENDPOINTS.login, payload);
    return toAuthSession(data);
  },

  async register(payload) {
    const { data } = await http.post(AUTH_ENDPOINTS.register, payload);
    return toAuthSession(data);
  },

  async loginWithGoogle(idToken) {
    const { data } = await http.post(AUTH_ENDPOINTS.google, { idToken });
    return toAuthSession(data);
  },

  async me() {
    const { data } = await http.get(AUTH_ENDPOINTS.me);
    return toUser(data);
  },

  async logout() {
    // The backend revokes the refresh token it is given. No token → nothing to revoke.
    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) return;
    // Short timeout: signing out must never hang on a slow server.
    await http.post(AUTH_ENDPOINTS.logout, { refreshToken }, { timeout: 4_000 });
  },
};

export const authApi = withMock(realAuthApi, mockAuthApi);
