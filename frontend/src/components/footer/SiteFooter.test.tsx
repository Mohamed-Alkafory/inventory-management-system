import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import SiteFooter from "./SiteFooter";
import { isStorefrontPath } from "./storefrontPaths";

const renderAt = (pathname: string) =>
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <SiteFooter />
    </MemoryRouter>,
  );

afterEach(cleanup);

describe("isStorefrontPath", () => {
  it("matches public storefront pages", () => {
    for (const path of ["/", "/about", "/contact", "/products", "/products/42", "/products?q=box"]) {
      expect(isStorefrontPath(path)).toBe(true);
    }
  });

  it("excludes dashboards, auth and account pages", () => {
    for (const path of ["/admin", "/staff/orders", "/support", "/login", "/register", "/profile", "/settings", "/cart"]) {
      expect(isStorefrontPath(path)).toBe(false);
    }
  });
});

describe("SiteFooter", () => {
  it("renders on a storefront page", () => {
    renderAt("/about");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("does not render on app pages", () => {
    renderAt("/admin");
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });
});
