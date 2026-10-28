/**
 * Static filter catalog for the audit trail — mirrors the actions the
 * backend services actually write (users, products, orders, POs, stock).
 * Values are sent to `GET /audit-logs` verbatim (exact-match filters).
 */
export const ENTITY_TYPES: Array<{ value: string; label: string }> = [
  { value: "", label: "All entities" },
  { value: "user", label: "Users" },
  { value: "product", label: "Products" },
  { value: "order", label: "Orders" },
  { value: "purchase_order", label: "Purchase orders" },
  { value: "stock_movement", label: "Stock movements" },
];

/** Actions grouped by entity — the "Action" select narrows as an entity is picked. */
export const ACTIONS_BY_ENTITY: Record<string, Array<{ value: string; label: string }>> = {
  user: [
    { value: "", label: "All user actions" },
    { value: "user.updated", label: "User updated" },
    { value: "user.deactivated", label: "User deactivated" },
    { value: "user.password_changed", label: "Password changed" },
  ],
  product: [
    { value: "", label: "All product actions" },
    { value: "product.created", label: "Product created" },
    { value: "product.updated", label: "Product updated" },
    { value: "product.deleted", label: "Product deleted" },
  ],
  order: [
    { value: "", label: "All order actions" },
    { value: "order.created", label: "Order placed" },
    { value: "order.updated", label: "Order updated" },
    { value: "order.cancelled", label: "Order cancelled" },
  ],
  purchase_order: [
    { value: "", label: "All PO actions" },
    { value: "purchase_order.received", label: "PO received" },
  ],
  stock_movement: [
    { value: "", label: "All stock actions" },
    { value: "stock.adjusted", label: "Stock adjusted" },
  ],
};

/** Action <option> list for the given entity (falls back to every action). */
export function actionsFor(entityType: string): Array<{ value: string; label: string }> {
  const group = ACTIONS_BY_ENTITY[entityType];
  if (group) return group;
  return Object.values(ACTIONS_BY_ENTITY)
    .flat()
    .filter((a) => a.value !== "");
}

/** Friendly words for the row chips: "purchase_order.received" → "Purchase order · received". */
export function humanizeAction(action: string): string {
  return action
    .split(".")
    .pop()
    ?.replace(/_/g, " ") ?? action;
}

export function humanizeEntityType(entityType: string): string {
  return ENTITY_TYPES.find((e) => e.value === entityType)?.label.replace(/s$/, "") ?? entityType.replace(/_/g, " ");
}
