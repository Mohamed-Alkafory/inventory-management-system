import type { Role } from "../types/auth";

/**
 * UI-only capability map. It mirrors the backend permission table so screens
 * can hide actions a role may not perform; the backend still enforces every
 * request, so this is never a security boundary.
 *
 * Keep the names close to the backend permissions:
 *   orders.confirm        → orders.update_status (PENDING → CONFIRMED)
 *   orders.cancelPending  → orders.cancel_pending (PENDING only)
 *   orders.cancelConfirmed→ orders.update_status (CONFIRMED → CANCELLED)
 *   orders.cancelOwn      → orders.cancel_own (CUSTOMER, own PENDING order)
 *   orders.notes.read     → orders.notes.read (SUPPORT/STAFF/ADMIN)
 *   orders.notes.write    → orders.notes.write (SUPPORT/STAFF/ADMIN)
 *   contact.read          → contact.read (SUPPORT/ADMIN)
 *   contact.manage        → contact.manage (SUPPORT/ADMIN)
 *   stock.adjust          → stock.adjust
 *   po.receive            → purchase_orders.receive
 *   po.create             → purchase_orders.create
 *   po.updateStatus       → purchase_orders.update_status
 *   products.write        → products.create/update/delete
 *   suppliers.write       → suppliers.create/update/delete
 */
export type Capability =
  | "orders.confirm"
  | "orders.cancelPending"
  | "orders.cancelConfirmed"
  | "orders.cancelOwn"
  | "orders.notes.read"
  | "orders.notes.write"
  | "contact.read"
  | "contact.manage"
  | "stock.adjust"
  | "po.receive"
  | "po.create"
  | "po.updateStatus"
  | "products.write"
  | "suppliers.write";

const CAPABILITIES: Record<Role, readonly Capability[]> = {
  ADMIN: [
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
  ],
  STAFF: [
    "orders.confirm",
    "orders.cancelPending",
    "orders.cancelConfirmed",
    "orders.notes.read",
    "orders.notes.write",
    "stock.adjust",
    "po.receive",
  ],
  SUPPORT: ["orders.cancelPending", "orders.notes.read", "orders.notes.write", "contact.read", "contact.manage"],
  CUSTOMER: ["orders.cancelOwn"],
};

/** Whether `role` may use `capability` in the UI. Missing roles get nothing. */
export function can(role: Role | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return CAPABILITIES[role]?.includes(capability) ?? false;
}
