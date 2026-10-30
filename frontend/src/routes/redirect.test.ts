import { describe, expect, it } from "vitest";
import { areaForPath, canRoleAccessPath, getPostLoginTarget, homePathForRole } from "./redirect";

const from = (pathname: string, search = "", hash = "") => ({ from: { pathname, search, hash } });

describe("homePathForRole", () => {
  it.each([
    ["ADMIN", "/admin"],
    ["STAFF", "/staff"],
    ["SUPPORT", "/support"],
    ["CUSTOMER", "/dashboard"],
  ] as const)("maps %s to %s", (role, path) => {
    expect(homePathForRole(role)).toBe(path);
  });

  it("falls back to / when the role is missing", () => {
    expect(homePathForRole(null)).toBe("/");
    expect(homePathForRole(undefined)).toBe("/");
  });
});

describe("areaForPath", () => {
  it.each([
    ["/admin", "admin"],
    ["/admin/products", "admin"],
    ["/staff/orders/new", "staff"],
    ["/support/messages/m-1", "support"],
    ["/dashboard", "customer"],
    ["/dashboard/orders/o-1", "customer"],
  ] as const)("maps %s to the %s area", (path, area) => {
    expect(areaForPath(path)).toBe(area);
  });

  it("returns null on the storefront and for near-miss prefixes", () => {
    for (const path of ["/", "/products", "/products/1", "/cart", "/orders", "/profile", "/adminish", "/dashboardx"]) {
      expect(areaForPath(path)).toBeNull();
    }
  });
});

describe("canRoleAccessPath", () => {
  it("lets every role use public, catalogue and profile pages", () => {
    for (const role of ["ADMIN", "STAFF", "SUPPORT", "CUSTOMER"] as const) {
      for (const path of ["/", "/about", "/contact", "/forbidden", "/products", "/products/42", "/profile", "/settings"]) {
        expect(canRoleAccessPath(role, path)).toBe(true);
      }
    }
  });

  it("keeps guest-only pages out of the return-to target", () => {
    expect(canRoleAccessPath("ADMIN", "/login")).toBe(false);
    expect(canRoleAccessPath("CUSTOMER", "/register")).toBe(false);
  });

  it("applies the role groups", () => {
    expect(canRoleAccessPath("ADMIN", "/admin/users")).toBe(true);
    expect(canRoleAccessPath("STAFF", "/staff")).toBe(true);
    expect(canRoleAccessPath("SUPPORT", "/support")).toBe(true);
    expect(canRoleAccessPath("CUSTOMER", "/dashboard")).toBe(true);
    expect(canRoleAccessPath("CUSTOMER", "/dashboard/orders/o-1")).toBe(true);
    expect(canRoleAccessPath("CUSTOMER", "/cart")).toBe(true);
    expect(canRoleAccessPath("CUSTOMER", "/orders")).toBe(true);
    expect(canRoleAccessPath("STAFF", "/orders/new")).toBe(true);

    expect(canRoleAccessPath("STAFF", "/admin")).toBe(false);
    expect(canRoleAccessPath("SUPPORT", "/staff")).toBe(false);
    expect(canRoleAccessPath("CUSTOMER", "/orders/new")).toBe(false);
    expect(canRoleAccessPath("ADMIN", "/cart")).toBe(false);
    expect(canRoleAccessPath("ADMIN", "/dashboard")).toBe(false);
  });

  it("ignores query strings and hashes", () => {
    expect(canRoleAccessPath("CUSTOMER", "/orders?page=2#top")).toBe(true);
    expect(canRoleAccessPath("STAFF", "/admin/users?x=1")).toBe(false);
  });
});

describe("getPostLoginTarget", () => {
  it("uses the role home when there is no return-to location", () => {
    expect(getPostLoginTarget(null, "STAFF")).toBe("/staff");
    expect(getPostLoginTarget(undefined, "ADMIN")).toBe("/admin");
  });

  it("honours a return-to location the role may open", () => {
    expect(getPostLoginTarget(from("/admin/products"), "ADMIN")).toBe("/admin/products");
    expect(getPostLoginTarget(from("/orders", "?page=2", "#top"), "CUSTOMER")).toBe("/orders?page=2#top");
  });

  it("falls back to the role home when the role may not open it (never a 403 landing)", () => {
    expect(getPostLoginTarget(from("/admin/users"), "STAFF")).toBe("/staff");
    expect(getPostLoginTarget(from("/support"), "STAFF")).toBe("/staff");
    expect(getPostLoginTarget(from("/orders"), "SUPPORT")).toBe("/support");
  });

  it("never returns to /login or /register", () => {
    expect(getPostLoginTarget(from("/login"), "CUSTOMER")).toBe("/dashboard");
    expect(getPostLoginTarget(from("/register"), "ADMIN")).toBe("/admin");
  });

  it("rejects protocol-relative and malformed locations", () => {
    expect(getPostLoginTarget(from("//evil.example"), "CUSTOMER")).toBe("/dashboard");
    expect(getPostLoginTarget({ from: { pathname: "relative" } }, "CUSTOMER")).toBe("/dashboard");
  });
});
