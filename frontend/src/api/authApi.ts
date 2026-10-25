import type { AuthSession, LoginPayload, User } from "../types/auth";
import { toAuthSession, toUser } from "./authMappers";
import { AUTH_ENDPOINTS } from "./endpoints";
import { http } from "./http";
import { mockAuthApi } from "./mock/authMock";
import { withMock } from "./mockSwitch";

export type AuthApi = {
  login(payload: LoginPayload): Promise<AuthSession>;
  me(): Promise<User>;
  logout(): Promise<void>;
};

const realAuthApi: AuthApi = {
  async login(payload) {
    const { data } = await http.post(AUTH_ENDPOINTS.login, payload);
    return toAuthSession(data);
  },

  async me() {
    const { data } = await http.get(AUTH_ENDPOINTS.me);
    return toUser(data);
  },

  async logout() {
    // Short timeout: signing out must never hang on a slow server.
    await http.post(AUTH_ENDPOINTS.logout, null, { timeout: 4_000 });
  },
};

export const authApi = withMock(realAuthApi, mockAuthApi);
