import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tokenStorage } from "./api/tokenStorage";
import App from "./App";

// Never hit the network: AuthProvider re-validates the stored session once.
vi.mock("./api/authApi", () => ({
  authApi: {
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    me: vi.fn().mockImplementation(() => new Promise(() => {})),
  },
}));

const signIn = () =>
  tokenStorage.setSession({
    accessToken: "token",
    refreshToken: "refresh",
    user: { id: "1", name: "Test User", email: "test@prodexa.com", role: "ADMIN" },
  });

beforeEach(signIn);

afterEach(() => {
  cleanup();
  tokenStorage.clear();
  window.history.pushState({}, "", "/");
});

describe("App", () => {
  it("renders the app shell and redirects / to the dashboard", async () => {
    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 1, name: /welcome, test user/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });

  it("renders the not-found page for unknown routes", async () => {
    window.history.pushState({}, "", "/does-not-exist");
    window.dispatchEvent(new PopStateEvent("popstate"));

    render(<App />);

    expect(await screen.findByRole("heading", { level: 1, name: /page not found/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to dashboard/i })).toHaveAttribute("href", "/dashboard");
  });
});
