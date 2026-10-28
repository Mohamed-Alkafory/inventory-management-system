import type { PoAction, PoStatus } from "./types";

export const PO_STATUSES: PoStatus[] = ["draft", "ordered", "partially_received", "received", "cancelled"];

export const PO_STATUS_LABEL: Record<PoStatus, string> = {
  draft: "Draft",
  ordered: "Ordered",
  partially_received: "Partially Received",
  received: "Received",
  cancelled: "Cancelled",
};

/**
 * Manual lifecycle rules (the backend answers 409 for anything else):
 *   order   — DRAFT → ORDERED
 *   cancel  — DRAFT | ORDERED → CANCELLED
 * Receiving is separate (a dialog, not a transition): the backend refuses
 * DRAFT/CANCELLED/RECEIVED with 409, so the UI offers "Receive stock"
 * only for ordered or partially_received orders.
 */
export const ACTION_RULES: Record<PoAction, { from: PoStatus[] }> = {
  order: { from: ["draft"] },
  cancel: { from: ["draft", "ordered"] },
};

export function allowedActions(status: PoStatus): PoAction[] {
  return (Object.keys(ACTION_RULES) as PoAction[]).filter((a) => ACTION_RULES[a].from.includes(status));
}

/** A PO can take deliveries only between its order being placed and full receipt. */
export function canReceive(status: PoStatus): boolean {
  return status === "ordered" || status === "partially_received";
}
