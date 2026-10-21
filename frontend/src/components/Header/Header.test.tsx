import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Header from "./Header";

describe("Header mobile menu", () => {
  it("exposes a toggle that opens and closes the nav", () => {
    render(<Header />);

    const toggle = screen.getByRole("button", { name: /open menu/i });
    const nav = document.getElementById("main-nav")!;

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(nav.className).not.toContain("is-open");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(nav.className).toContain("is-open");
    expect(screen.getByRole("button", { name: /close menu/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /close menu/i }));
    expect(nav.className).not.toContain("is-open");
  });
});
