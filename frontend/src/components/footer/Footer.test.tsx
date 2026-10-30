import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import Footer from "./Footer";

const renderFooter = () =>
  render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  );

afterEach(cleanup);

describe("Footer", () => {
  it("renders the brand, link columns and copyright", () => {
    renderFooter();

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^PRODEXA/i })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Shop" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Account" })).toBeInTheDocument();
    expect(screen.getByText(/All rights reserved/i)).toBeInTheDocument();
  });

  it("points its links at real routes", () => {
    renderFooter();

    expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute("href", "/products");
    expect(screen.getByRole("link", { name: "About us" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/contact");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("link", { name: "My profile" })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("link", { name: "support@prodexa.com" })).toHaveAttribute(
      "href",
      "mailto:support@prodexa.com",
    );
  });
});
