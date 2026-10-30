import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/errors";
import { tokenStorage } from "../../api/tokenStorage";
import ToastProvider from "../../components/ui/toast/ToastProvider";
import AuthProvider from "../../context/auth/AuthProvider";
import GuestRoute from "../../routes/GuestRoute";
import type { Role } from "../../types/auth";
import Login from "./Login";

const login = vi.hoisted(() => vi.fn());

vi.mock("../../api/authApi", () => ({
  authApi: { login, logout: vi.fn().mockResolvedValue(undefined), me: vi.fn() },
}));

function renderLogin() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <AuthProvider>
            <Routes>
              <Route element={<GuestRoute />}>
                <Route path="/login" element={<Login />} />
              </Route>
              <Route path="/admin" element={<p>Admin page</p>} />
              <Route path="/staff" element={<p>Staff page</p>} />
              <Route path="/support" element={<p>Support page</p>} />
              <Route path="/dashboard" element={<p>Customer dashboard</p>} />
              <Route path="/" element={<p>Home page</p>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const signInAs = (role: Role) =>
  login.mockResolvedValue({
    user: { id: "1", name: "Test User", email: "test@prodexa.com", role },
    tokens: { accessToken: "a", refreshToken: "r" },
  });

const submitCredentials = () => {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "test@prodexa.com" } });
  fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: "Strong#Pass1" } });
  fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
};

beforeEach(() => {
  tokenStorage.clear();
  login.mockReset();
});
afterEach(cleanup);

describe("Login page", () => {
  it("validates the form before calling the API", async () => {
    renderLogin();

    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("shows the API error when credentials are wrong", async () => {
    login.mockRejectedValue(new ApiError("Invalid email or password.", { status: 401 }));
    renderLogin();

    submitCredentials();

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password.");
  });

  it.each([
    ["ADMIN", "Admin page"],
    ["STAFF", "Staff page"],
    ["SUPPORT", "Support page"],
    ["CUSTOMER", "Customer dashboard"],
  ] as const)("redirects a signed-in %s to its role home", async (role, text) => {
    signInAs(role);
    renderLogin();

    submitCredentials();

    await waitFor(() => expect(screen.getByText(text)).toBeInTheDocument());
    expect(tokenStorage.getSession()?.user.role).toBe(role);
  });

  it("does not offer Google sign-in", () => {
    renderLogin();
    expect(screen.queryByText(/google/i)).not.toBeInTheDocument();
  });
});
