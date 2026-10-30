import { afterEach, describe, expect, it, vi } from "vitest";
import { ROLES } from "../../../types/auth";
import { normalizeUser, usersApi } from "../api";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const user = (id: string) => ({
  id,
  name: `User ${id}`,
  email: `${id}@example.com`,
  role: "STAFF",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normalizeUser", () => {
  it("keeps every backend role as-is", () => {
    for (const role of ROLES) {
      expect(normalizeUser({ ...user("u1"), role }).role).toBe(role);
    }
  });

  it("accepts a ROLE_ prefix but never remaps", () => {
    expect(normalizeUser({ ...user("u1"), role: "ROLE_SUPPORT" }).role).toBe("SUPPORT");
  });

  it("throws on an unknown role instead of coercing it", () => {
    expect(() => normalizeUser({ ...user("u1"), role: "OWNER" })).toThrow(/unknown user role/i);
    expect(() => normalizeUser({ ...user("u1"), role: "admin " })).toThrow(/unknown user role/i);
  });
});

describe("usersApi.list", () => {
  it("reads the total from meta.total, not from the current page length", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [user("u1"), user("u2")],
        meta: { page: 2, limit: 10, total: 23, totalPages: 3 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const page = await usersApi.list({ search: "", role: "", page: 2, pageSize: 10 });

    expect(page.items.map((u) => u.id)).toEqual(["u1", "u2"]);
    expect(page.total).toBe(23);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/users\?page=2&limit=10$/),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("still honours a top-level total when the server sends one", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: [user("u1")], total: 7 })));

    const page = await usersApi.list({ search: "", role: "", page: 1, pageSize: 10 });

    expect(page.total).toBe(7);
  });

  it("falls back to the page length when neither total is present", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: [user("u1"), user("u2")] })));

    const page = await usersApi.list({ search: "", role: "", page: 1, pageSize: 10 });

    expect(page.total).toBe(2);
  });
});
