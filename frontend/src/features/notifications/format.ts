import type { Role } from "../../types/auth";
import type { NotificationItem } from "./types";

const encode = (id: string) => encodeURIComponent(id);

/**
 * Where a notification points for the signed-in role. `null` means the role
 * has no route for that entity; the caller still marks the row read and stays.
 *
 * | entityType       | ADMIN                        | STAFF                        | SUPPORT                     | CUSTOMER             |
 * | ---------------- | ---------------------------- | ---------------------------- | --------------------------- | -------------------- |
 * | order            | /admin/orders/:id            | /staff/orders/:id            | /support/orders/:id         | /orders/:id          |
 * | product          | /staff/products/:id          | /staff/products/:id          | —                           | /products/:id        |
 * | purchase-order   | /admin/purchase-orders/:id   | /staff/purchase-orders/:id   | —                           | —                    |
 * | contact_message  | /support/messages/:id        | —                            | /support/messages/:id       | —                    |
 */
export function notificationPath(
  notification: Pick<NotificationItem, "entityType" | "entityId">,
  role: Role,
): string | null {
  const id = notification.entityId;
  if (!id) return null;

  const kind = notification.entityType?.toLowerCase().replace(/[_-]/g, "") ?? "";
  const suffix = `/${encode(id)}`;

  switch (kind) {
    case "order":
      if (role === "ADMIN") return `/admin/orders${suffix}`;
      if (role === "STAFF") return `/staff/orders${suffix}`;
      if (role === "SUPPORT") return `/support/orders${suffix}`;
      return `/orders${suffix}`;

    case "product":
      if (role === "CUSTOMER") return `/products${suffix}`;
      if (role === "ADMIN" || role === "STAFF") return `/staff/products${suffix}`;
      return null;

    case "purchaseorder":
      if (role === "ADMIN") return `/admin/purchase-orders${suffix}`;
      if (role === "STAFF") return `/staff/purchase-orders${suffix}`;
      return null;

    case "contactmessage":
      if (role === "ADMIN" || role === "SUPPORT") return `/support/messages${suffix}`;
      return null;

    default:
      return null;
  }
}

/** "9+" for counts above nine, otherwise the number as a string. */
export const unreadBadgeLabel = (count: number): string => (count > 9 ? "9+" : String(count));

const MINUTE = 60_000;const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Short relative timestamp ("Just now", "5m ago", "3h ago", "2d ago", then a date). */
export function relativeTime(iso: string, now = Date.now()): string {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return "";

  const diff = now - time;
  if (diff < 45_000) return "Just now";
  if (diff < HOUR) return `${Math.max(1, Math.floor(diff / MINUTE))}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;

  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(time));
}

const exactDateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/** Tooltip/accessible title for a timestamp. */
export const exactTime = (iso: string) => (iso ? exactDateTime.format(new Date(iso)) : "");
