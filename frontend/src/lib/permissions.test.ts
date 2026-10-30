import { describe, expect, it } from "vitest";
import { can } from "./permissions";
import type { Capability } from "./permissions";

const CAPABILITIES: Capability[] = [
  "orders.confirm",
  "orders.cancelPending",
  "orders.cancelConfirmed",
  "orders.cancelOwn",
  "orders.notes.read",
  "orders.notes.write",
  "contact.read",
  "contact.manage",
  "stock.adjust",
  "po.receive",
  "po.create",
  "po.updateStatus",
  "products.write",
  "suppliers.write",
];

describe("can", () => {
  it("gives ADMIN every capability", () => {
    for (const capability of CAPABILITIES) expect(can("ADMIN", capability)).toBe(true);
  });

  it("lets STAFF run orders/stock and receive POs, but not write products/PO lifecycle", () => {
    expect(can("STAFF", "orders.confirm")).toBe(true);
    expect(can("STAFF", "orders.cancelPending")).toBe(true);
    expect(can("STAFF", "orders.cancelConfirmed")).toBe(true);
    expect(can("STAFF", "orders.notes.read")).toBe(true);
    expect(can("STAFF", "orders.notes.write")).toBe(true);
    expect(can("STAFF", "stock.adjust")).toBe(true);
    expect(can("STAFF", "po.receive")).toBe(true);

    expect(can("STAFF", "po.create")).toBe(false);
    expect(can("STAFF", "po.updateStatus")).toBe(false);
    expect(can("STAFF", "products.write")).toBe(false);
    expect(can("STAFF", "suppliers.write")).toBe(false);
    expect(can("STAFF", "orders.cancelOwn")).toBe(false);
    expect(can("STAFF", "contact.read")).toBe(false);
    expect(can("STAFF", "contact.manage")).toBe(false);
  });

  it("gives SUPPORT pending cancellation, order notes and the inbox only", () => {
    for (const capability of ["orders.cancelPending", "orders.notes.read", "orders.notes.write", "contact.read", "contact.manage"] as const) {
      expect(can("SUPPORT", capability)).toBe(true);
    }
    for (const capability of CAPABILITIES.filter(
      (c) => !["orders.cancelPending", "orders.notes.read", "orders.notes.write", "contact.read", "contact.manage"].includes(c),
    )) {
      expect(can("SUPPORT", capability)).toBe(false);
    }
  });

  it("gives CUSTOMER only their own order cancellation", () => {
    expect(can("CUSTOMER", "orders.cancelOwn")).toBe(true);
    for (const capability of CAPABILITIES.filter((c) => c !== "orders.cancelOwn")) {
      expect(can("CUSTOMER", capability)).toBe(false);
    }
  });

  it("gives guests nothing", () => {
    for (const role of [null, undefined]) {
      for (const capability of CAPABILITIES) expect(can(role, capability)).toBe(false);
    }
  });
});
