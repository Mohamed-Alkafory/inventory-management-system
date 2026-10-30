import { afterEach, describe, expect, it, vi } from "vitest";
import { realCustomerOrdersApi, realStaffOrdersApi } from "../api";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const customerOrder = {
  id: "o-1",
  orderNumber: "ORD-0001",
  status: "PENDING",
  totalAmount: 12,
  items: [],
  recipientName: "Cara",
  createdAt: "2026-01-01T00:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("realCustomerOrdersApi", () => {
  it("lists /orders/mine with page/limit/status only", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [customerOrder], meta: { total: 1 } }));
    vi.stubGlobal("fetch", fetchMock);

    const page = await realCustomerOrdersApi.listMyOrders({ status: "PENDING", page: 2, pageSize: 10 });

    const url = new URL(fetchMock.mock.calls[0][0] as string, "http://localhost");
    expect(url.pathname).toBe("/api/v1/orders/mine");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("limit")).toBe("10");
    expect(url.searchParams.get("status")).toBe("PENDING");
    expect(url.searchParams.has("search")).toBe(false);
    expect(url.searchParams.has("createdById")).toBe(false);
    expect(page.items[0].orderNumber).toBe("ORD-0001");
  });

  it("creates /orders/mine with only the documented fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(customerOrder, 201));
    vi.stubGlobal("fetch", fetchMock);

    await realCustomerOrdersApi.createMyOrder({
      items: [{ productId: "p-1", quantity: 2 }],
      recipientName: "Cara Customer",
      recipientPhone: "+20 100 000 0000",
      shippingAddress: "1 Nile Street",
      shippingCity: "Cairo",
      notes: "Call on arrival",
    });

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/orders\/mine$/);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      items: [{ productId: "p-1", quantity: 2 }],
      recipientName: "Cara Customer",
      recipientPhone: "+20 100 000 0000",
      shippingAddress: "1 Nile Street",
      shippingCity: "Cairo",
      notes: "Call on arrival",
    });
  });

  it("reads one own order and cancels it through /orders/mine/:id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(customerOrder))
      .mockResolvedValueOnce(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await realCustomerOrdersApi.getMyOrder("o-1");
    await realCustomerOrdersApi.cancelMyOrder("o-1");

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/orders\/mine\/o-1$/);
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/orders\/mine\/o-1\/cancel$/);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST" });
  });
});

describe("realStaffOrdersApi", () => {
  it("lists /orders with search, status and full-day date bounds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [], meta: { total: 0 } }));
    vi.stubGlobal("fetch", fetchMock);

    await realStaffOrdersApi.listOrders({
      search: " abd ",
      status: "CONFIRMED",
      from: "2026-01-01",
      to: "2026-01-31",
      page: 1,
      pageSize: 20,
    });

    const url = new URL(fetchMock.mock.calls[0][0] as string, "http://localhost");
    expect(url.pathname).toBe("/api/v1/orders");
    expect(url.searchParams.get("search")).toBe("abd");
    expect(url.searchParams.get("status")).toBe("CONFIRMED");
    expect(url.searchParams.get("from")).toBe("2026-01-01T00:00:00");
    expect(url.searchParams.get("to")).toBe("2026-01-31T23:59:59");
    expect(url.searchParams.has("createdById")).toBe(false);
  });

  it("uses PATCH /orders/:id/status for confirm and POST /orders/:id/cancel for cancelling", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await realStaffOrdersApi.updateOrderStatus("o-1", "CONFIRMED");
    await realStaffOrdersApi.cancelOrder("o-1");

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/orders\/o-1\/status$/);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "PATCH", body: JSON.stringify({ newStatus: "CONFIRMED" }) });
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/orders\/o-1\/cancel$/);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST" });
  });

  it("reads staff details from /orders/:id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ...customerOrder, customerName: "Ahmed" }));
    vi.stubGlobal("fetch", fetchMock);

    const order = await realStaffOrdersApi.getOrder("o-1");

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/orders\/o-1$/);
    expect(order.customerName).toBe("Ahmed");
  });

  it("lists and posts internal notes through /orders/:id/notes", async () => {
    const note = {
      id: "n-1",
      orderId: "o-1",
      authorId: "u-2",
      note: "Called the customer",
      author: { id: "u-2", name: "Sami Staff" },
      createdAt: "2026-01-02T09:00:00.000Z",
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse([note])).mockResolvedValueOnce(jsonResponse(note, 201));
    vi.stubGlobal("fetch", fetchMock);

    const notes = await realStaffOrdersApi.listNotes("o-1");
    await realStaffOrdersApi.addNote("o-1", "Called the customer");

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/orders\/o-1\/notes$/);
    expect((fetchMock.mock.calls[0][1] as RequestInit | undefined)?.method ?? "GET").toBe("GET");
    expect(notes).toEqual([
      {
        id: "n-1",
        orderId: "o-1",
        authorId: "u-2",
        note: "Called the customer",
        author: { id: "u-2", name: "Sami Staff" },
        createdAt: "2026-01-02T09:00:00.000Z",
      },
    ]);
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/orders\/o-1\/notes$/);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST", body: JSON.stringify({ note: "Called the customer" }) });
  });
});
