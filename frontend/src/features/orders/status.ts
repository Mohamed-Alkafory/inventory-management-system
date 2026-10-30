import { can } from "../../lib/permissions";
import type { Role } from "../../types/auth";
import type { OrderAction, OrderStatus } from "./types";

export const STATUSES: OrderStatus[] = ["PENDING", "CONFIRMED", "CANCELLED"];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
};

/** Tailwind classes for <StatusBadge>. Kept here with the labels. */
export const STATUS_TONE: Record<OrderStatus, string> = {
  PENDING: "bg-[#FFEAB6] text-[#B7791F]",
  CONFIRMED: "bg-[#DDF5EA] text-[#1F8F6B]",
  CANCELLED: "bg-[#FFD6D8] text-[#C53030]",
};

/** Action labels and the status each one produces. */
export const ACTION_RULES: Record<OrderAction, { to: OrderStatus; label: string }> = {
  confirm: { to: "CONFIRMED", label: "Confirm order" },
  cancel: { to: "CANCELLED", label: "Cancel order" },
};

/**
 * ► THE ONLY PLACE THAT DECIDES WHO MAY DO WHAT.
 *
 * Mirrors the backend permission map and transitions:
 *   CUSTOMER  orders.cancel_own     → cancel own PENDING only
 *   SUPPORT   orders.cancel_pending → cancel PENDING only (never confirms)
 *   STAFF     orders.update_status  → confirm PENDING; cancel PENDING/CONFIRMED
 *   ADMIN     every permission      → same as STAFF for orders
 *
 * Components must call this with the signed-in role instead of deriving
 * actions from the status alone.
 */
export function getOrderActions(role: Role | null | undefined, order: { status: OrderStatus }): OrderAction[] {
  const actions: OrderAction[] = [];

  if (order.status === "PENDING" && can(role, "orders.confirm")) actions.push("confirm");
  if (
    order.status === "PENDING" &&
    (can(role, "orders.cancelPending") || can(role, "orders.cancelOwn"))
  ) {
    actions.push("cancel");
  }
  if (order.status === "CONFIRMED" && can(role, "orders.cancelConfirmed")) actions.push("cancel");

  return actions;
}
