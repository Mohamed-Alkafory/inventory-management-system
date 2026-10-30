import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";
import aboutBanner from "./img/about-banner.png";

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
});

describe("App", () => {
  it("renders the header and the home page on /", () => {
    render(<App />);

    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByRole("main")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/know exactly what you have/i);
  });

  it("resolves the About banner image through the bundler", () => {
    window.history.pushState({}, "", "/about");
    render(<App />);

    const img = document.querySelector("main img") as HTMLImageElement;
    expect(img).toBeTruthy();
    // The src must come from the imported asset module (bundled by Vite), not a raw "/src/..." string.
    expect(img.getAttribute("src")).toBe(aboutBanner);
  });

  it("renders the mounted NotFound page for unknown paths", () => {
    window.history.pushState({}, "", "/no-such-page");
    render(<App />);

    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });
});
