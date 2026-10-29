import type { OrderAction, OrderStatus } from "./types";

export const STATUSES: OrderStatus[] = ["pending", "processing", "shipped", "delivered", "cancelled"];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/**
 * ► THE ONLY PLACE THAT DEFINES VALID TRANSITIONS.
 *   An action is offered only when the order's current status is in `from`.
 *   (If the API sends `allowedActions` for an order, that wins over this table.)
 */
export const ACTION_RULES: Record<OrderAction, { from: OrderStatus[]; to: OrderStatus; label: string }> = {
  confirm: { from: ["pending"], to: "processing", label: "Confirm order" },
  cancel: { from: ["pending", "processing"], to: "cancelled", label: "Cancel order" },
};

const ACTIONS = Object.keys(ACTION_RULES) as OrderAction[];

export function allowedActions(o: { status: OrderStatus; allowedActions?: OrderAction[] }): OrderAction[] {
  if (o.allowedActions) return ACTIONS.filter((a) => o.allowedActions!.includes(a));
  return ACTIONS.filter((a) => ACTION_RULES[a].from.includes(o.status));
}
