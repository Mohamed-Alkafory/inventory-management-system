/** Mirrors the backend's prisma `NotificationType` enum — do not reorder. */
export type NotificationType = "LOW_STOCK" | "ORDER_CREATED" | "ORDER_CANCELLED" | "PURCHASE_ORDER_RECEIVED" | "SYSTEM";

export const ALL_NOTIFICATION_TYPES: NotificationType[] = [
  "LOW_STOCK",
  "ORDER_CREATED",
  "ORDER_CANCELLED",
  "PURCHASE_ORDER_RECEIVED",
  "SYSTEM",
];

/** One `GET/PUT /notifications/preferences` row (defaults filled server-side). */
export type NotificationPreference = {
  type: NotificationType;
  enabled: boolean;
};

/** Human copy for the preferences UI, keyed by the backend enum value. */
export const NOTIFICATION_LABELS: Record<NotificationType, { title: string; description: string }> = {
  LOW_STOCK: {
    title: "Low stock alerts",
    description: "A product's quantity drops below its minimum level.",
  },
  ORDER_CREATED: {
    title: "New orders",
    description: "A customer places a new order.",
  },
  ORDER_CANCELLED: {
    title: "Order cancellations",
    description: "A customer order is cancelled.",
  },
  PURCHASE_ORDER_RECEIVED: {
    title: "Purchase orders received",
    description: "A purchase order is marked as received.",
  },
  SYSTEM: {
    title: "System messages",
    description: "Operational and account notices.",
  },
};

export type NotificationsApi = {
  /** GET /notifications/preferences — the full type list, defaults filled. */
  preferences(): Promise<NotificationPreference[]>;
  /** PUT /notifications/preferences — batch on/off upserts; returns the full list. */
  updatePreferences(preferences: Array<Pick<NotificationPreference, "type" | "enabled">>): Promise<NotificationPreference[]>;
};
