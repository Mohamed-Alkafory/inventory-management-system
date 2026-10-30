import { afterEach, describe, expect, it } from "vitest";
import { tokenStorage } from "../../../api/tokenStorage";
import { ApiError } from "../../../lib/http";
import type { Role } from "../../../types/auth";
import { mockContactMessagesApi } from "../mockApi";

const signIn = (id = "u-me", role: Role = "SUPPORT") =>
  tokenStorage.setSession({
    accessToken: `mock-access.${id}`,
    refreshToken: "mock-refresh",
    user: { id, name: "Sam Support", email: "support@prodexa.com", role },
  });

afterEach(() => tokenStorage.clear());

const all = { status: "", assignedToId: "", search: "", page: 1, pageSize: 50 } as const;

describe("mockContactMessagesApi", () => {
  it("filters by status, assignee and search", async () => {
    signIn();

    const resolved = await mockContactMessagesApi.list({ ...all, status: "RESOLVED" });
    expect(resolved.items.length).toBeGreaterThan(0);
    expect(resolved.items.every((m) => m.status === "RESOLVED")).toBe(true);

    const assigned = await mockContactMessagesApi.list({ ...all, assignedToId: "99999999-9999-4999-8999-999999999999" });
    expect(assigned.items.length).toBeGreaterThan(0);
    expect(assigned.items.every((m) => m.assignedToId === "99999999-9999-4999-8999-999999999999")).toBe(true);

    const searched = await mockContactMessagesApi.list({ ...all, search: "OMAR" });
    expect(searched.items.every((m) => `${m.name} ${m.email} ${m.subject}`.toLowerCase().includes("omar"))).toBe(true);
  });

  it("paginates and keeps the total", async () => {
    signIn();
    const page = await mockContactMessagesApi.list({ ...all, page: 1, pageSize: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.total).toBeGreaterThan(2);
  });

  it("answers 403 for roles without contact access", async () => {
    signIn("staff-1", "STAFF");
    await expect(mockContactMessagesApi.list(all)).rejects.toMatchObject({ status: 403 });
    await expect(mockContactMessagesApi.get("88888888-8888-4888-8888-888888888801")).rejects.toMatchObject({ status: 403 });
    await expect(
      mockContactMessagesApi.update("88888888-8888-4888-8888-888888888801", { status: "RESOLVED" }),
    ).rejects.toMatchObject({ status: 403 });

    signIn("customer-1", "CUSTOMER");
    await expect(mockContactMessagesApi.list(all)).rejects.toMatchObject({ status: 403 });
  });

  it("updates status, assignee and the internal note", async () => {
    signIn("u-me");
    const [first] = (await mockContactMessagesApi.list(all)).items;

    const updated = await mockContactMessagesApi.update(first.id, {
      status: "IN_PROGRESS",
      assignedToId: "u-me",
      internalNote: "Claimed by me",
    });

    expect(updated).toMatchObject({
      status: "IN_PROGRESS",
      assignedToId: "u-me",
      assignedTo: { id: "u-me", name: "Sam Support" },
      internalNote: "Claimed by me",
    });
    await expect(mockContactMessagesApi.get(first.id)).resolves.toMatchObject({ internalNote: "Claimed by me" });
  });

  it("unassigns and answers 404 for an unknown message", async () => {
    signIn();
    const [first] = (await mockContactMessagesApi.list(all)).items;

    const cleared = await mockContactMessagesApi.update(first.id, { assignedToId: null, internalNote: null });
    expect(cleared.assignedToId).toBeNull();
    expect(cleared.assignedTo).toBeNull();
    expect(cleared.internalNote).toBeNull();

    await expect(mockContactMessagesApi.get("missing")).rejects.toBeInstanceOf(ApiError);
    await expect(mockContactMessagesApi.update("missing", { status: "RESOLVED" })).rejects.toMatchObject({ status: 404 });
  });
});
