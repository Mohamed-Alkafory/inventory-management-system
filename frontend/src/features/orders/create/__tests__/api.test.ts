import { afterEach, describe, expect, it, vi } from "vitest";
import { realOrderBuilderApi } from "../api";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("realOrderBuilderApi", () => {
  it("searches products with the backend's limit param and no pageSize", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [], meta: { total: 0 } }));
    vi.stubGlobal("fetch", fetchMock);

    await realOrderBuilderApi.searchProducts(" bottle ");

    const url = new URL(fetchMock.mock.calls[0][0] as string, "http://localhost");
    expect(url.pathname).toBe("/api/v1/products");
    expect(url.searchParams.get("limit")).toBe("20");
    expect(url.searchParams.get("search")).toBe("bottle");
    expect(url.searchParams.has("pageSize")).toBe(false);
  });

  it("posts the real POST /orders payload with flat customer fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "o-1", orderNumber: "ORD-0001" }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const created = await realOrderBuilderApi.createOrder({
      customer: { name: " Ahmed Mohamed ", phone: " +20 100 000 0000 " },
      notes: " Call before delivery ",
      items: [{ productId: "p-1", quantity: 2 }],
    });

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/orders$/);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      items: [{ productId: "p-1", quantity: 2 }],
      customerName: "Ahmed Mohamed",
      customerPhone: "+20 100 000 0000",
      notes: "Call before delivery",
    });
    expect(created).toEqual({ id: "o-1", number: "ORD-0001" });
  });

  it("omits empty optional customer fields and notes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "o-1", orderNumber: "ORD-0001" }, 201));
    vi.stubGlobal("fetch", fetchMock);

    await realOrderBuilderApi.createOrder({
      customer: { name: "Walk-in", phone: "" },
      notes: "  ",
      items: [{ productId: "p-1", quantity: 1 }],
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      items: [{ productId: "p-1", quantity: 1 }],
      customerName: "Walk-in",
    });
  });
});
