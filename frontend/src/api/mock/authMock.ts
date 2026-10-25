import type { AuthApi } from "../authApi";
import { ApiError } from "../errors";
import { delay } from "../mockSwitch";
import { tokenStorage } from "../tokenStorage";
import type { User } from "../../types/auth";

/* Demo accounts available while VITE_USE_MOCK=true */
export const MOCK_ACCOUNTS: (User & { password: string })[] = [
  { id: "1", name: "Amira Admin", email: "admin@prodexa.com", password: "Admin@123", role: "ADMIN" },
  { id: "2", name: "Sami Staff", email: "staff@prodexa.com", password: "Staff@123", role: "STAFF" },
];

const strip = (a: (typeof MOCK_ACCOUNTS)[number]): User => ({ id: a.id, name: a.name, email: a.email, role: a.role });

export const mockAuthApi: AuthApi = {
  async login({ email, password }) {
    await delay();
    const account = MOCK_ACCOUNTS.find((a) => a.email.toLowerCase() === email.toLowerCase() && a.password === password);
    if (!account) throw new ApiError("Invalid email or password.", { status: 401 });

    return {
      user: strip(account),
      tokens: { accessToken: `mock-access.${account.id}`, refreshToken: `mock-refresh.${account.id}` },
    };
  },

  async me() {
    await delay(150);
    const id = tokenStorage.getAccessToken()?.split(".")[1];
    const account = MOCK_ACCOUNTS.find((a) => a.id === id);
    if (!account) throw new ApiError("Session expired.", { status: 401 });
    return strip(account);
  },

  async logout() {
    await delay(100);
  },
};
