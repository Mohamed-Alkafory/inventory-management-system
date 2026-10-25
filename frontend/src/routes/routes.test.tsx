import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tokenStorage } from "../api/tokenStorage";
import AuthProvider from "../context/auth/AuthProvider";
import type { Role } from "../types/auth";
import GuestRoute from "./GuestRoute";
import ProtectedRoute from "./ProtectedRoute";
import RoleRoute from "./RoleRoute";

// Never hit the network: the provider re-validates the stored session through authApi.me().
vi.mock("../api/authApi", () => ({
  authApi: {
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    me: vi.fn().mockImplementation(() => new Promise(() => {})),
  },
}));

const signIn = (role: Role) =>
  tokenStorage.setSession({
    accessToken: "token",
    refreshToken: "refresh",
    user: { id: "1", name: "Test User", email: "test@prodexa.com", role },
  });

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<p>Login page</p>} />
          <Route path="/forbidden" element={<p>Forbidden page</p>} />
          <Route element={<GuestRoute />}>
            <Route path="/guest-only" element={<p>Guest page</p>} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<p>Dashboard page</p>} />
            <Route element={<RoleRoute allow={["ADMIN"]} />}>
              <Route path="/admin" element={<p>Admin page</p>} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => tokenStorage.clear());
afterEach(cleanup);

describe("route guards", () => {
  it("redirects unauthenticated users to /login", () => {
    renderAt("/dashboard");
    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("redirects unauthenticated users away from admin routes too", () => {
    renderAt("/admin");
    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("lets a signed-in STAFF user into protected routes", () => {
    signIn("STAFF");
    renderAt("/dashboard");
    expect(screen.getByText("Dashboard page")).toBeInTheDocument();
  });

  it("rejects STAFF on admin-only routes", () => {
    signIn("STAFF");
    renderAt("/admin");
    expect(screen.getByText("Forbidden page")).toBeInTheDocument();
    expect(screen.queryByText("Admin page")).not.toBeInTheDocument();
  });

  it("lets ADMIN into admin-only routes", () => {
    signIn("ADMIN");
    renderAt("/admin");
    expect(screen.getByText("Admin page")).toBeInTheDocument();
  });

  it("sends signed-in users away from guest-only pages", () => {
    signIn("ADMIN");
    renderAt("/guest-only");
    expect(screen.getByText("Dashboard page")).toBeInTheDocument();
  });
});
