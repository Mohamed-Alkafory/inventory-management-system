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
import Register from "./Register";

const register = vi.hoisted(() => vi.fn());

vi.mock("../../api/authApi", () => ({
  authApi: { login: vi.fn(), register, logout: vi.fn().mockResolvedValue(undefined), me: vi.fn() },
}));

function renderRegister() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/register"]}>
          <AuthProvider>
            <Routes>
              <Route element={<GuestRoute />}>
                <Route path="/register" element={<Register />} />
              </Route>
              <Route path="/dashboard" element={<p>Customer dashboard</p>} />
              <Route path="/" element={<p>Home page</p>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const fill = (password: string, confirm = password) => {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Nour Ahmed" } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "nour@prodexa.com" } });
  fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: password } });
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: confirm } });
};

const submit = () => fireEvent.click(screen.getByRole("button", { name: /^create account$/i }));

beforeEach(() => {
  tokenStorage.clear();
  register.mockReset();
});
afterEach(cleanup);

describe("Register page", () => {
  it("ticks the password rules live", () => {
    renderRegister();
    const rules = screen.getByRole("list", { name: /rules for your password/i });
    expect(rules).toHaveTextContent("not met yet");

    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: "Strong#Pass1" } });
    expect(rules).not.toHaveTextContent("not met yet");
  });

  it("blocks weak passwords, mismatches and missing terms", async () => {
    renderRegister();

    submit();
    expect(await screen.findByText("Enter your full name")).toBeInTheDocument();
    expect(screen.getByText("You must accept the terms to continue")).toBeInTheDocument();

    fill("weakpass", "different");
    submit();
    expect(await screen.findByText("Password doesn’t meet all the rules below")).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox"));
    fill("Strong#Pass1", "Strong#Pass2");
    submit();
    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("shows the server error (e.g. email already used)", async () => {
    register.mockRejectedValue(new ApiError("An account with this email already exists.", { status: 409 }));
    renderRegister();

    fill("Strong#Pass1");
    fireEvent.click(screen.getByRole("checkbox"));
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent("An account with this email already exists.");
  });

  it("creates a CUSTOMER account and lands on the customer dashboard", async () => {
    register.mockResolvedValue({
      user: { id: "9", name: "Nour Ahmed", email: "nour@prodexa.com", role: "CUSTOMER" },
      tokens: { accessToken: "a", refreshToken: "r" },
    });
    renderRegister();

    fill("Strong#Pass1");
    fireEvent.click(screen.getByRole("checkbox"));
    submit();

    await waitFor(() => expect(screen.getByText("Customer dashboard")).toBeInTheDocument());
    expect(register).toHaveBeenCalledWith({ name: "Nour Ahmed", email: "nour@prodexa.com", password: "Strong#Pass1" });
    expect(tokenStorage.getSession()?.user.role).toBe("CUSTOMER");
  });

  it("does not offer seller account types or Google sign-up", () => {
    renderRegister();
    expect(screen.queryByText(/seller/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/google/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
