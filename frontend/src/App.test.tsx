import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the header and the about page together", () => {
    render(<App />);

    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByRole("main")).toBeTruthy();
    expect(document.getElementById("about")).toBeTruthy();
  });

  it("resolves the hero image through the bundler", () => {
    render(<App />);

    const img = document.querySelector("main img") as HTMLImageElement;
    expect(img).toBeTruthy();
    // A raw "./src/assets/..." path is not processed by Vite and 404s in production.
    expect(img.getAttribute("src")).not.toContain("./src/assets");
  });
});
