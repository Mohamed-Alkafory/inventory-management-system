import type { AuthApi } from "../authApi";
import { ApiError } from "../errors";
import { delay } from "../mockSwitch";
import { tokenStorage } from "../tokenStorage";
import type { AuthSession, UpdateProfilePayload, User } from "../../types/auth";

type MockAccount = User & { password: string };

/* Built-in demo accounts available while VITE_USE_MOCK=true */
export const MOCK_ACCOUNTS: MockAccount[] = [
  { id: "1", name: "Amira Admin", email: "admin@prodexa.com", password: "Admin@123", role: "ADMIN" },
  { id: "2", name: "Sami Staff", email: "staff@prodexa.com", password: "Staff@123", role: "STAFF" },
  { id: "3", name: "Sara Support", email: "support@prodexa.com", password: "Support@123", role: "SUPPORT" },
  { id: "4", name: "Cara Customer", email: "customer@prodexa.com", password: "Customer@123", role: "CUSTOMER" },
];

/* Accounts created through the Register page are kept in localStorage (mock only). */
const STORE_KEY = "prodexa.mock.users.v1";

function loadExtra(): MockAccount[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as MockAccount[]) : [];
  } catch {
    return [];
  }
}

function saveExtra(accounts: MockAccount[]) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(accounts));
  } catch {
    /* storage unavailable — the account just won't persist */
  }
}

const allAccounts = () => [...MOCK_ACCOUNTS, ...loadExtra()];
const strip = (a: MockAccount): User => ({
  id: a.id,
  name: a.name,
  email: a.email,
  role: a.role,
  avatarUrl: a.avatarUrl ?? null,
});
const sessionFor = (a: MockAccount): AuthSession => ({
  user: strip(a),
  tokens: { accessToken: `mock-access.${a.id}`, refreshToken: `mock-refresh.${a.id}` },
});

/** Registered accounts survive a reload; the built-in demos reset. */
function persistAccount(account: MockAccount) {
  if (!MOCK_ACCOUNTS.some((a) => a.id === account.id)) {
    saveExtra(loadExtra().map((a) => (a.id === account.id ? account : a)));
  }
}

function createAccount(name: string, email: string, password: string): MockAccount {
  // Public registration always creates a CUSTOMER; callers cannot choose a role.
  const account: MockAccount = { id: `u-${Date.now()}`, name, email, password, role: "CUSTOMER" };
  saveExtra([...loadExtra(), account]);
  return account;
}

export const mockAuthApi: AuthApi = {
  async login({ email, password }) {
    await delay();
    const account = allAccounts().find(
      (a) => a.email.toLowerCase() === email.toLowerCase() && a.password !== "" && a.password === password,
    );
    if (!account) throw new ApiError("Invalid email or password.", { status: 401 });
    return sessionFor(account);
  },

  async register({ name, email, password }) {
    await delay(600);
    if (allAccounts().some((a) => a.email.toLowerCase() === email.toLowerCase())) {
      throw new ApiError("An account with this email already exists.", { status: 409 });
    }
    return sessionFor(createAccount(name, email, password));
  },

  async me() {
    await delay(150);
    const id = tokenStorage.getAccessToken()?.split(".")[1];
    const account = allAccounts().find((a) => a.id === id);
    if (!account) throw new ApiError("Session expired.", { status: 401 });
    return strip(account);
  },

  async updateProfile(payload: UpdateProfilePayload) {
    await delay();
    const id = tokenStorage.getAccessToken()?.split(".")[1];
    const account = allAccounts().find((a) => a.id === id);
    if (!account || account.password === "") {
      throw new ApiError("Session expired.", { status: 401 });
    }

    if (payload.name !== undefined) account.name = payload.name;
    if (payload.password) {
      if (account.password && payload.password.current !== account.password) {
        throw new ApiError("Current password is incorrect.", { status: 422 });
      }
      account.password = payload.password.next;
    }

    persistAccount(account);

    return strip(account);
  },

  async uploadAvatar(file) {
    await delay(600);
    const id = tokenStorage.getAccessToken()?.split(".")[1];
    const account = allAccounts().find((a) => a.id === id);
    if (!account) throw new ApiError("Session expired.", { status: 401 });

    account.avatarUrl =
      typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : `mock-avatar.${file.name}`;
    persistAccount(account);
    return strip(account);
  },

  async removeAvatar() {
    await delay(400);
    const id = tokenStorage.getAccessToken()?.split(".")[1];
    const account = allAccounts().find((a) => a.id === id);
    if (!account) throw new ApiError("Session expired.", { status: 401 });

    account.avatarUrl = null;
    persistAccount(account);
  },

  async deleteAccount() {
    await delay();
    const id = tokenStorage.getAccessToken()?.split(".")[1];
    if (MOCK_ACCOUNTS.some((a) => a.id === id)) {
      throw new ApiError("The built-in demo account cannot be deleted.", { status: 403 });
    }
    saveExtra(loadExtra().filter((a) => a.id !== id));
  },

  async logout() {
    await delay(100);
  },
};
