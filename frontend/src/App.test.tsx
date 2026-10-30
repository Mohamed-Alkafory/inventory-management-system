import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
});

describe("App", () => {
  it("renders the app shell and the public home page at /", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { level: 1, name: /know exactly/i })).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });

  it("renders the not-found page for unknown routes", async () => {
    window.history.pushState({}, "", "/does-not-exist");
    window.dispatchEvent(new PopStateEvent("popstate"));

    render(<App />);

    expect(await screen.findByRole("heading", { level: 1, name: /page not found/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to home/i })).toHaveAttribute("href", "/");
  });

  it("renders the mounted NotFound page for unknown paths", () => {
    window.history.pushState({}, "", "/no-such-page");
    render(<App />);

    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });
});
