import { afterEach, describe, expect, it } from "vitest";
import { ROLES } from "../types/auth";
import { tokenStorage } from "./tokenStorage";

const store = (role: string) =>
  localStorage.setItem(
    tokenStorage.KEY,
    JSON.stringify({
      accessToken: "access",
      refreshToken: "refresh",
      user: { id: "1", name: "Test User", email: "test@prodexa.com", role },
    }),
  );

afterEach(() => localStorage.clear());

describe("tokenStorage session validation", () => {
  it.each(ROLES)("accepts a stored %s session", (role) => {
    store(role);
    expect(tokenStorage.getSession()?.user.role).toBe(role);
  });

  it("discards a session with an unknown role", () => {
    store("OWNER");
    expect(tokenStorage.getSession()).toBeNull();
    expect(tokenStorage.getAccessToken()).toBeNull();
  });
});
