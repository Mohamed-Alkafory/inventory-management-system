import { describe, expect, it } from "vitest";
import {
  normalizeCustomerOrder,
  normalizeStaffOrder,
  readStatus,
  toCustomerOrderPage,
  toStaffOrderPage,
} from "../normalize";

const customerRaw = {
  id: "o-1",
  orderNumber: "ORD-0001",
  status: "PENDING",
  totalAmount: "49.98",
  items: [
    { productName: "Water Bottle", sku: "SKU-1", quantity: 2, unitPrice: "19.99", lineTotal: "39.98" },
    { productName: "Lamp", sku: "SKU-2", quantity: 1, unitPrice: 10, lineTotal: 10 },
  ],
  recipientName: "Cara Customer",
  recipientPhone: "+20 100 000 0000",
  shippingAddress: "1 Nile Street",
  shippingCity: "Cairo",
  paymentMethod: "COD",
  createdAt: "2026-01-01T10:00:00.000Z",
  cancelledAt: null,
};

describe("readStatus", () => {
  it("accepts the three backend states case-insensitively", () => {
    expect(readStatus("PENDING")).toBe("PENDING");
    expect(readStatus("confirmed")).toBe("CONFIRMED");
    expect(readStatus("Cancelled")).toBe("CANCELLED");
  });

  it("treats the US spelling as cancelled and ignores unknown values", () => {
    expect(readStatus("canceled")).toBe("CANCELLED");
    expect(readStatus("processing")).toBeUndefined();
    expect(readStatus("shipped")).toBeUndefined();
    expect(readStatus("delivered")).toBeUndefined();
    expect(readStatus(undefined)).toBeUndefined();
  });
});

describe("normalizeCustomerOrder", () => {
  it("maps the customer-safe shape without internal fields", () => {
    const order = normalizeCustomerOrder(customerRaw);

    expect(order).toMatchObject({
      id: "o-1",
      orderNumber: "ORD-0001",
      status: "PENDING",
      totalAmount: 49.98,
      recipientName: "Cara Customer",
      recipientPhone: "+20 100 000 0000",
      shippingAddress: "1 Nile Street",
      shippingCity: "Cairo",
      paymentMethod: "COD",
      createdAt: "2026-01-01T10:00:00.000Z",
    });
    expect(order.items).toEqual([
      { productName: "Water Bottle", sku: "SKU-1", quantity: 2, unitPrice: 19.99, lineTotal: 39.98 },
      { productName: "Lamp", sku: "SKU-2", quantity: 1, unitPrice: 10, lineTotal: 10 },
    ]);
    expect("createdBy" in order).toBe(false);
    expect("notes" in order).toBe(false);
  });

  it("tolerates missing fields and never turns personal data into empty strings", () => {
    const order = normalizeCustomerOrder({});

    expect(order).toMatchObject({
      id: "",
      orderNumber: "",
      status: "PENDING",
      totalAmount: 0,
      items: [],
    });
    expect(order.recipientName).toBeUndefined();
    expect(order.recipientPhone).toBeUndefined();
    expect(order.shippingAddress).toBeUndefined();
    expect(order.shippingCity).toBeUndefined();
    expect(order.paymentMethod).toBeUndefined();
    expect(order.cancelledAt).toBeUndefined();
  });

  it("derives a total from the lines when totalAmount is absent", () => {
    expect(normalizeCustomerOrder({ ...customerRaw, totalAmount: undefined }).totalAmount).toBe(49.98);
  });
});

describe("normalizeStaffOrder", () => {
  it("maps list rows that omit phone and address (SUPPORT)", () => {
    const order = normalizeStaffOrder({
      id: "o-2",
      orderNumber: "ORD-0002",
      status: "CONFIRMED",
      customerName: "Ahmed Mohamed",
      totalAmount: 79.99,
      createdById: "u-1",
      createdAt: "2026-01-02T10:00:00.000Z",
      updatedAt: "2026-01-02T11:00:00.000Z",
    });

    expect(order.customerName).toBe("Ahmed Mohamed");
    expect(order.customerPhone).toBeUndefined();
    expect(order.recipientPhone).toBeUndefined();
    expect(order.shippingAddress).toBeUndefined();
    expect(order.items).toBeUndefined();
  });

  it("maps detail fields: items, createdBy and stock movements", () => {
    const order = normalizeStaffOrder({
      ...customerRaw,
      customerName: "Cara Customer",
      customerPhone: "+20 111 111 1111",
      notes: "Call before delivery",
      createdById: "u-9",
      items: customerRaw.items,
      createdBy: { id: "u-9", name: "Sami Staff", email: "staff@prodexa.com" },
      stockMovements: [
        { id: "sm-1", productId: "p-1", type: "SALE", quantityChange: -2, quantityAfter: 8, createdAt: "2026-01-01T10:00:00.000Z" },
      ],
    });

    expect(order.customerName).toBe("Cara Customer");
    expect(order.customerPhone).toBe("+20 111 111 1111");
    expect(order.notes).toBe("Call before delivery");
    expect(order.createdBy).toEqual({ id: "u-9", name: "Sami Staff", email: "staff@prodexa.com" });
    expect(order.items).toHaveLength(2);
    expect(order.items?.[0].productName).toBe("Water Bottle");
    expect(order.stockMovements?.[0]).toMatchObject({ type: "SALE", quantityChange: -2, quantityAfter: 8 });
  });
});

describe("page normalizers", () => {
  it("reads the backend { data, meta } envelope for both scopes", () => {
    const body = { data: [customerRaw], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } };

    expect(toCustomerOrderPage(body, { status: "", page: 1, pageSize: 10 })).toMatchObject({
      total: 1,
      items: [{ orderNumber: "ORD-0001" }],
    });
    expect(toStaffOrderPage(body, { search: "", status: "", from: "", to: "", page: 1, pageSize: 10 })).toMatchObject({
      total: 1,
      items: [{ orderNumber: "ORD-0001" }],
    });
  });

  it("filters and paginates a plain array fallback", () => {
    const page = toCustomerOrderPage([customerRaw, { ...customerRaw, id: "o-2", orderNumber: "ORD-0002", status: "CANCELLED" }], {
      status: "PENDING",
      page: 1,
      pageSize: 10,
    });

    expect(page.total).toBe(1);
    expect(page.items[0].orderNumber).toBe("ORD-0001");
  });
});
