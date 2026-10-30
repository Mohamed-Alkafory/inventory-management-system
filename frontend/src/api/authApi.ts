import type { AuthSession, LoginPayload, RegisterPayload, UpdateProfilePayload, User } from "../types/auth";
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
  me(): Promise<User>;
  /** Updates the signed-in user's name and/or password; resolves with the fresh user. */
  updateProfile(payload: UpdateProfilePayload): Promise<User>;
  /** Uploads the signed-in user's avatar; resolves with the updated user. */
  uploadAvatar(file: File): Promise<User>;
  /** Removes the signed-in user's avatar (204). */
  removeAvatar(): Promise<void>;
  /** Deactivates the signed-in account. The local session is cleared by the caller. */
  deleteAccount(): Promise<void>;
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

  async me() {
    const { data } = await http.get(AUTH_ENDPOINTS.me);
    return toUser(data);
  },

  async updateProfile(payload) {
    const { data } = await http.patch(AUTH_ENDPOINTS.updateMe, payload);
    return toUser(data);
  },

  async uploadAvatar(file) {
    const form = new FormData();
    form.append("image", file);
    // The axios instance drops its JSON Content-Type for FormData so the
    // browser sets multipart/form-data with the boundary.
    const { data } = await http.post(AUTH_ENDPOINTS.avatar, form);
    return toUser(data);
  },

  async removeAvatar() {
    // The backend answers 204 No Content.
    await http.delete(AUTH_ENDPOINTS.avatar);
  },

  async deleteAccount() {
    // The backend deactivates the account and revokes every refresh token;
    // it answers 204 even if the account is already deactivated.
    await http.delete(AUTH_ENDPOINTS.deleteMe);
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
