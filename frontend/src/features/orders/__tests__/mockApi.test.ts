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
});
