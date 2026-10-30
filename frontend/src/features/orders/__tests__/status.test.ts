import { describe, expect, it } from "vitest";
import type { Role } from "../../../types/auth";
import { STATUS_LABEL, STATUS_TONE, getOrderActions } from "../status";
import type { OrderStatus } from "../types";

const STATUSES: OrderStatus[] = ["PENDING", "CONFIRMED", "CANCELLED"];

describe("getOrderActions", () => {
  it("lets STAFF and ADMIN confirm only PENDING and cancel PENDING or CONFIRMED", () => {
    for (const role of ["STAFF", "ADMIN"] as const) {
      expect(getOrderActions(role, { status: "PENDING" })).toEqual(["confirm", "cancel"]);
      expect(getOrderActions(role, { status: "CONFIRMED" })).toEqual(["cancel"]);
      expect(getOrderActions(role, { status: "CANCELLED" })).toEqual([]);
    }
  });

  it("lets SUPPORT cancel PENDING only and never confirm", () => {
    expect(getOrderActions("SUPPORT", { status: "PENDING" })).toEqual(["cancel"]);
    expect(getOrderActions("SUPPORT", { status: "CONFIRMED" })).toEqual([]);
    expect(getOrderActions("SUPPORT", { status: "CANCELLED" })).toEqual([]);
  });

  it("lets CUSTOMER cancel their PENDING order only", () => {
    expect(getOrderActions("CUSTOMER", { status: "PENDING" })).toEqual(["cancel"]);
    expect(getOrderActions("CUSTOMER", { status: "CONFIRMED" })).toEqual([]);
    expect(getOrderActions("CUSTOMER", { status: "CANCELLED" })).toEqual([]);
  });

  it("gives guests no actions for any status", () => {
    for (const role of [null, undefined] as Array<Role | null | undefined>) {
      for (const status of STATUSES) {
        expect(getOrderActions(role, { status })).toEqual([]);
      }
    }
  });
});

describe("status presentation", () => {
  it("has a label and tone for each of the three statuses only", () => {
    expect(Object.keys(STATUS_LABEL).sort()).toEqual(["CANCELLED", "CONFIRMED", "PENDING"]);
    expect(Object.keys(STATUS_TONE).sort()).toEqual(["CANCELLED", "CONFIRMED", "PENDING"]);
    expect(STATUS_LABEL.PENDING).toBe("Pending");
    expect(STATUS_LABEL.CONFIRMED).toBe("Confirmed");
    expect(STATUS_LABEL.CANCELLED).toBe("Cancelled");
  });
});
