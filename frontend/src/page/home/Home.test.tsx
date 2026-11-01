import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import Home from "./Home";

afterEach(cleanup);

const renderHome = () =>
  render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );

describe("Home page", () => {
  it("renders the hero, key sections and calls to action", () => {
    renderHome();

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/know exactly what you have/i);
    expect(screen.getByRole("heading", { name: "Everything You Need" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /built for every role/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /up and running in three steps/i })).toBeInTheDocument();

    // The four role workspaces are shown with their titles.
    ["Admin", "Staff", "Support", "Customer"].forEach((role) =>
      expect(screen.getByRole("heading", { name: role })).toBeInTheDocument(),
    );

    const demos = screen.getAllByRole("link", { name: /request a demo/i });
    expect(demos.length).toBeGreaterThanOrEqual(2);
    demos.forEach((a) => expect(a).toHaveAttribute("href", "/contact"));
  });

  it("links to the public catalog", () => {
    renderHome();

    const browse = screen.getByRole("link", { name: /browse products/i });
    expect(browse).toHaveAttribute("href", "/products");
  });

  it("opens and closes FAQ answers", () => {
    renderHome();

    const first = screen.getByRole("button", { name: /how does prodexa keep stock counts accurate/i });
    expect(first).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-expanded", "false");

    const second = screen.getByRole("button", { name: /low-stock alerts work/i });
    fireEvent.click(second);
    expect(second).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(second.getAttribute("aria-controls")!)).toBeInTheDocument();
  });
});
