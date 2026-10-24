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
    expect(screen.getByRole("heading", { name: /up and running in three steps/i })).toBeInTheDocument();

    const trials = screen.getAllByRole("link", { name: /start 14-day free trial/i });
    expect(trials.length).toBeGreaterThanOrEqual(2);
    trials.forEach((a) => expect(a).toHaveAttribute("href", "/contact"));
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
