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
              <Route path="/dashboard" element={<p>Dashboard page</p>} />
              <Route path="/" element={<p>Home page</p>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

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

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "staff@prodexa.com" } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: "wrong-pass" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password.");
  });

  it("signs in and redirects to the home page", async () => {
    login.mockResolvedValue({
      user: { id: "2", name: "Sami Staff", email: "staff@prodexa.com", role: "STAFF" },
      tokens: { accessToken: "a", refreshToken: "r" },
    });
    renderLogin();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "staff@prodexa.com" } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: "Staff@123" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(screen.getByText("Home page")).toBeInTheDocument());
    expect(tokenStorage.getSession()?.user.role).toBe("STAFF");
  });
});
