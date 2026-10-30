import { afterEach, describe, expect, it } from "vitest";
import { tokenStorage } from "../../../api/tokenStorage";
import { ApiError } from "../../../lib/http";
import { mockCustomerOrdersApi, mockStaffOrdersApi } from "../mockApi";

const signIn = (id = "4") =>
  tokenStorage.setSession({
    accessToken: `mock-access.${id}`,
    refreshToken: "mock-refresh",
    user: { id, name: "Cara Customer", email: "customer@prodexa.com", role: "CUSTOMER" },
  });

afterEach(() => tokenStorage.clear());

describe("mockCustomerOrdersApi", () => {
  it("lists only the signed-in customer's orders in the customer-safe shape", async () => {
    signIn("4");

    const page = await mockCustomerOrdersApi.listMyOrders({ status: "", page: 1, pageSize: 20 });

    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.some((order) => order.id === 10)).toBe(false);
    for (const order of page.items) {
      expect(["PENDING", "CONFIRMED", "CANCELLED"]).toContain(order.status);
      expect(order).toHaveProperty("recipientName");
      expect(order).not.toHaveProperty("createdBy");
      expect(order).not.toHaveProperty("notes");
    }
  });

  it("answers 404 for an order owned by somebody else", async () => {
    signIn("4");

    await expect(mockCustomerOrdersApi.getMyOrder(1)).resolves.toMatchObject({ id: 1 });
    await expect(mockCustomerOrdersApi.getMyOrder(10)).rejects.toBeInstanceOf(ApiError);
    await expect(mockCustomerOrdersApi.getMyOrder(10)).rejects.toMatchObject({ status: 404 });
  });

  it("cancels a PENDING own order once and rejects a second cancel with 409", async () => {
    signIn("4");

    await expect(mockCustomerOrdersApi.cancelMyOrder(6)).resolves.toBeUndefined();
    await expect(mockCustomerOrdersApi.getMyOrder(6)).resolves.toMatchObject({
      status: "CANCELLED",
      cancelledAt: expect.any(String),
    });
    await expect(mockCustomerOrdersApi.cancelMyOrder(6)).rejects.toMatchObject({ status: 409 });
  });
});

describe("mockStaffOrdersApi", () => {
  it("lists every order in the staff shape and returns detail fields", async () => {
    const page = await mockStaffOrdersApi.listOrders({ search: "", status: "", from: "", to: "", page: 1, pageSize: 20 });

    expect(page.total).toBe(12);
    expect(page.items[0]).toHaveProperty("customerName");
    expect(page.items[0]).not.toHaveProperty("items");

    const detail = await mockStaffOrdersApi.getOrder(1);
    expect(detail.items?.length).toBeGreaterThan(0);
    expect(detail.createdBy).toMatchObject({ name: expect.any(String) });
    expect(detail).toHaveProperty("stockMovements");
  });

  it("confirms PENDING orders and rejects invalid transitions with 409", async () => {
    await expect(mockStaffOrdersApi.updateOrderStatus(1, "CONFIRMED")).resolves.toBeUndefined();
    await expect(mockStaffOrdersApi.updateOrderStatus(1, "CONFIRMED")).rejects.toMatchObject({ status: 409 });

    // CONFIRMED → CANCELLED is the one staff transition after confirmation.
    await expect(mockStaffOrdersApi.updateOrderStatus(1, "CANCELLED")).resolves.toBeUndefined();
    await expect(mockStaffOrdersApi.getOrder(1)).resolves.toMatchObject({ status: "CANCELLED" });
  });

  it("uses the pending-only cancel route", async () => {
    await expect(mockStaffOrdersApi.cancelOrder(2)).rejects.toMatchObject({ status: 409 }); // already CONFIRMED
    await expect(mockStaffOrdersApi.cancelOrder(9)).resolves.toBeUndefined(); // PENDING
  });

  it("lists and appends internal notes, oldest first", async () => {
    signIn("2");

    const before = await mockStaffOrdersApi.listNotes(2);
    expect(before.length).toBeGreaterThan(0);
    expect(before[0].note).toBe("Confirmed by phone. Courier booked.");

    const created = await mockStaffOrdersApi.addNote(2, "  Courier confirmed the new slot  ");
    expect(created).toMatchObject({
      orderId: "2",
      note: "Courier confirmed the new slot",
      authorId: "2",
    });

    const after = await mockStaffOrdersApi.listNotes(2);
    expect(after.map((n) => n.id)).toContain(created.id);
    expect(after.at(-1)?.note).toBe("Courier confirmed the new slot");
  });

  it("rejects blank, oversized and foreign-order notes", async () => {
    await expect(mockStaffOrdersApi.addNote(2, "   ")).rejects.toMatchObject({ status: 400 });
    await expect(mockStaffOrdersApi.addNote(2, "x".repeat(2001))).rejects.toMatchObject({ status: 400 });
    await expect(mockStaffOrdersApi.addNote("missing", "hello")).rejects.toMatchObject({ status: 404 });
    await expect(mockStaffOrdersApi.listNotes("missing")).rejects.toMatchObject({ status: 404 });
  });
});

describe("mockCustomerOrdersApi.createMyOrder", () => {
  const input = {
    items: [{ productId: "p-1", quantity: 2 }],
    recipientName: "Cara Customer",
    recipientPhone: "+20 100 000 0000",
    shippingAddress: "1 Nile Street",
    shippingCity: "Cairo",
    notes: "Call on arrival",
  };

  it("creates a PENDING own order in the customer-safe shape", async () => {
    signIn("4");

    const order = await mockCustomerOrdersApi.createMyOrder(input);

    expect(order).toMatchObject({
      status: "PENDING",
      recipientName: "Cara Customer",
      shippingCity: "Cairo",
      paymentMethod: "COD",
    });
    expect(order.items[0]).toMatchObject({ quantity: 2, productName: expect.any(String) });
    expect(order).not.toHaveProperty("notes");
    expect(order).not.toHaveProperty("createdBy");
    await expect(mockCustomerOrdersApi.getMyOrder(order.id)).resolves.toMatchObject({ id: order.id });
  });

  it("answers 409 with the failing product when stock is insufficient", async () => {
    signIn("4");

    // p-2 only has 9 mock units available.
    await expect(
      mockCustomerOrdersApi.createMyOrder({
        ...input,
        items: [{ productId: "p-2", quantity: 10 }],
      }),
    ).rejects.toMatchObject({
      status: 409,
      body: { message: expect.stringContaining("product p-2") },
    });
  });

  it("rejects an out-of-range quantity with 400", async () => {
    signIn("4");

    await expect(
      mockCustomerOrdersApi.createMyOrder({
        ...input,
        items: [{ productId: "p-1", quantity: 51 }],
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
