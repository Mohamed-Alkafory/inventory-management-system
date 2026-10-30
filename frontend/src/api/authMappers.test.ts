import { describe, expect, it } from "vitest";
import { ROLES } from "../types/auth";
import { toRole } from "./authMappers";

describe("toRole", () => {
  it.each(ROLES)("accepts %s", (role) => {
    expect(toRole(role)).toBe(role);
  });

  it("is case-insensitive and tolerates a ROLE_ prefix", () => {
    expect(toRole("admin")).toBe("ADMIN");
    expect(toRole("role_support")).toBe("SUPPORT");
  });

  it("rejects unknown roles instead of coercing them", () => {
    for (const value of ["OWNER", "ROLE_", "", null, undefined, 42]) {
      expect(() => toRole(value)).toThrow(/role/i);
    }
  });
});
