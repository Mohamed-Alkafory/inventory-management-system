import type { Role } from "../../types/auth";

/** Every notification type the backend can write. */
export const NOTIFICATION_TYPES = [
  "LOW_STOCK",
  "ORDER_CREATED",
  "ORDER_CONFIRMED",
  "ORDER_CANCELLED",
  "PURCHASE_ORDER_RECEIVED",
  "CONTACT_MESSAGE_RECEIVED",
  "SYSTEM",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  LOW_STOCK: "Low stock",
  ORDER_CREATED: "New order",
  ORDER_CONFIRMED: "Order confirmed",
  ORDER_CANCELLED: "Order cancelled",
  PURCHASE_ORDER_RECEIVED: "Purchase order received",
  CONTACT_MESSAGE_RECEIVED: "Contact message",
  SYSTEM: "System",
};

/**
 * Types that can fan out to each role, based on the backend notification
 * service. Preferences only offer the switches a user can actually receive.
 */
export const ROLE_NOTIFICATION_TYPES: Record<Role, NotificationType[]> = {
  ADMIN: ["LOW_STOCK", "ORDER_CREATED", "ORDER_CANCELLED", "PURCHASE_ORDER_RECEIVED"],
  STAFF: ["ORDER_CREATED"],
  SUPPORT: ["CONTACT_MESSAGE_RECEIVED"],
  CUSTOMER: ["ORDER_CONFIRMED", "ORDER_CANCELLED"],
};

/** One row from GET /notifications. `entityType`/`entityId` drive deep links. */
export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export type NotificationSortField = "createdAt" | "type";
export type SortOrder = "asc" | "desc";

export interface NotificationListParams {
  page: number;
  pageSize: number;
  /** undefined = both read and unread. */
  unread?: boolean;
  type?: NotificationType;
  sortBy?: NotificationSortField;
  sortOrder?: SortOrder;
}

export interface NotificationPage {
  items: NotificationItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface NotificationPreference {
  type: NotificationType;
  enabled: boolean;
}

export interface NotificationPreferenceInput {
  type: NotificationType;
  enabled: boolean;
}

export interface NotificationsApi {
  list(params: NotificationListParams): Promise<NotificationPage>;
  unreadCount(): Promise<number>;
  markRead(id: string): Promise<NotificationItem>;
  markAllRead(): Promise<number>;
  getPreferences(): Promise<NotificationPreference[]>;
  updatePreferences(preferences: NotificationPreferenceInput[]): Promise<NotificationPreference[]>;
}
