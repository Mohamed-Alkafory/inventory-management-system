import { afterEach, describe, expect, it, vi } from "vitest";
import { realContactMessagesApi } from "../api";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const row = {
  id: "m-1",
  name: "Jane Doe",
  email: "jane@example.com",
  subject: "Damaged order",
  message: "Cracked bottle",
  status: "NEW",
  assignedToId: null,
  assignedTo: null,
  internalNote: null,
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-01T10:00:00.000Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("realContactMessagesApi", () => {
  it("lists /contact-messages with only the documented query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [row], meta: { total: 12 } }));
    vi.stubGlobal("fetch", fetchMock);

    const page = await realContactMessagesApi.list({
      status: "NEW",
      assignedToId: "u-1",
      search: " jane ",
      page: 2,
      pageSize: 10,
    });

    const url = new URL(fetchMock.mock.calls[0][0] as string, "http://localhost");
    expect(url.pathname).toBe("/api/v1/contact-messages");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: "2",
      limit: "10",
      status: "NEW",
      assignedToId: "u-1",
      search: "jane",
    });
    expect(page.total).toBe(12);
    expect(page.items[0]).toMatchObject({ id: "m-1", status: "NEW" });
  });

  it("gets one message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(row));
    vi.stubGlobal("fetch", fetchMock);

    const message = await realContactMessagesApi.get("m-1");
    const url = new URL(fetchMock.mock.calls[0][0] as string, "http://localhost");
    expect(url.pathname).toBe("/api/v1/contact-messages/m-1");
    expect(message).toMatchObject({ id: "m-1", subject: "Damaged order" });
  });

  it("patches status, assignee and internal note", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ...row, status: "IN_PROGRESS", assignedToId: null }));
    vi.stubGlobal("fetch", fetchMock);

    await realContactMessagesApi.update("m-1", { status: "IN_PROGRESS", assignedToId: null, internalNote: null });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url, "http://localhost").pathname).toBe("/api/v1/contact-messages/m-1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ status: "IN_PROGRESS", assignedToId: null, internalNote: null });
  });
});
