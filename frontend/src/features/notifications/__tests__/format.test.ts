import { describe, expect, it } from "vitest";
import { relativeTime, unreadBadgeLabel, notificationPath } from "../format";
import type { NotificationItem } from "../types";
import type { Role } from "../../../types/auth";

const item = (entityType: string | null, entityId: string | null = "entity-1"): Pick<NotificationItem, "entityType" | "entityId"> => ({
  entityType,
  entityId,
});

describe("unreadBadgeLabel", () => {
  it("hides at zero by returning the plain number and caps above nine", () => {
    expect(unreadBadgeLabel(0)).toBe("0");
    expect(unreadBadgeLabel(1)).toBe("1");
    expect(unreadBadgeLabel(9)).toBe("9");
    expect(unreadBadgeLabel(10)).toBe("9+");
    expect(unreadBadgeLabel(250)).toBe("9+");
  });
});

describe("notificationPath", () => {
  it("maps orders to the role's order area", () => {
    expect(notificationPath(item("order", "o-1"), "CUSTOMER")).toBe("/orders/o-1");
    expect(notificationPath(item("order", "o-1"), "STAFF")).toBe("/staff/orders/o-1");
    expect(notificationPath(item("order", "o-1"), "SUPPORT")).toBe("/support/orders/o-1");
    expect(notificationPath(item("order", "o-1"), "ADMIN")).toBe("/admin/orders/o-1");
  });

  it("maps products only where the role has a product route", () => {
    expect(notificationPath(item("product", "p-1"), "CUSTOMER")).toBe("/products/p-1");
    expect(notificationPath(item("product", "p-1"), "STAFF")).toBe("/staff/products/p-1");
    expect(notificationPath(item("product", "p-1"), "ADMIN")).toBe("/staff/products/p-1");
    expect(notificationPath(item("product", "p-1"), "SUPPORT")).toBeNull();
  });

  it("maps purchase orders and contact messages, and rejects unknown targets", () => {
    expect(notificationPath(item("purchase-order", "po-1"), "ADMIN")).toBe("/admin/purchase-orders/po-1");
    expect(notificationPath(item("purchase_order", "po-1"), "STAFF")).toBe("/staff/purchase-orders/po-1");
    expect(notificationPath(item("purchase-order", "po-1"), "SUPPORT")).toBeNull();

    expect(notificationPath(item("contact_message", "m-1"), "SUPPORT")).toBe("/support/messages/m-1");
    expect(notificationPath(item("contact-message", "m-1"), "ADMIN")).toBe("/support/messages/m-1");
    expect(notificationPath(item("contact_message", "m-1"), "CUSTOMER")).toBeNull();

    expect(notificationPath(item("SYSTEM", "x"), "ADMIN")).toBeNull();
    expect(notificationPath(item("order", null), "ADMIN")).toBeNull();
    expect(notificationPath(item(null), "ADMIN")).toBeNull();
  });

  it("encodes ids", () => {
    expect(notificationPath(item("order", "a/b"), "STAFF")).toBe("/staff/orders/a%2Fb");
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-10-30T12:00:00.000Z").getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it("uses short relative labels and falls back to a date", () => {
    expect(relativeTime(ago(10_000), now)).toBe("Just now");
    expect(relativeTime(ago(5 * 60_000), now)).toBe("5m ago");
    expect(relativeTime(ago(3 * 3_600_000), now)).toBe("3h ago");
    expect(relativeTime(ago(2 * 86_400_000), now)).toBe("2d ago");
    expect(relativeTime(ago(30 * 86_400_000), now)).not.toMatch(/ago/);
    expect(relativeTime("", now)).toBe("");
  });
});

describe("role type coverage", () => {
  it("has at least one applicable type for every role", async () => {
    const { ROLE_NOTIFICATION_TYPES } = await import("../types");
    const roles: Role[] = ["ADMIN", "STAFF", "SUPPORT", "CUSTOMER"];
    for (const role of roles) expect(ROLE_NOTIFICATION_TYPES[role].length).toBeGreaterThan(0);
  });
});
