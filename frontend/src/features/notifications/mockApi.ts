import { tokenStorage } from "../../api/tokenStorage";
import { ApiError } from "../../lib/http";
import type { Role } from "../../types/auth";
import { NOTIFICATION_TYPES } from "./types";
import type {
  NotificationItem,
  NotificationPreference,
  NotificationPreferenceInput,
  NotificationType,
  NotificationsApi,
} from "./types";

/*
  In-memory notifications stand-in (VITE_USE_MOCK=true). Every row is scoped
  to the signed-in user, exactly like the backend. Seeds give each role a
  few realistic notifications and preferences default to enabled.
*/

const HOUR = 3_600_000;
const now = Date.now();
const iso = (hoursAgo: number) => new Date(now - hoursAgo * HOUR).toISOString();

type Seed = Omit<NotificationItem, "id" | "readAt"> & { id?: string };

const SEEDS: Record<Role, Seed[]> = {
  ADMIN: [
    {
      type: "LOW_STOCK",
      title: "Low stock alert",
      message: "Hydrating Face Serum is low on stock (3 left, minimum 5).",
      entityType: "product",
      entityId: "22222222-2222-4222-8222-222222222201",
      isRead: false,
      createdAt: iso(1),
    },
    {
      type: "ORDER_CREATED",
      title: "New order",
      message: "Order ORD-1042 was created (total 1,240 EGP).",
      entityType: "order",
      entityId: "33333333-3333-4333-8333-333333333301",
      isRead: false,
      createdAt: iso(3),
    },
    {
      type: "PURCHASE_ORDER_RECEIVED",
      title: "Purchase order received",
      message: "Purchase order PO-204 was received into stock.",
      entityType: "purchase-order",
      entityId: "44444444-4444-4444-8444-444444444401",
      isRead: false,
      createdAt: iso(8),
    },
    {
      type: "ORDER_CANCELLED",
      title: "Order cancelled",
      message: "Order ORD-1039 was cancelled — stock restored.",
      entityType: "order",
      entityId: "33333333-3333-4333-8333-333333333302",
      isRead: true,
      createdAt: iso(26),
    },
  ],
  STAFF: [
    {
      type: "ORDER_CREATED",
      title: "New order",
      message: "Order ORD-1042 was created (total 1,240 EGP).",
      entityType: "order",
      entityId: "33333333-3333-4333-8333-333333333301",
      isRead: false,
      createdAt: iso(3),
    },
    {
      type: "ORDER_CREATED",
      title: "New order",
      message: "Order ORD-1038 was created (total 680 EGP).",
      entityType: "order",
      entityId: "33333333-3333-4333-8333-333333333303",
      isRead: true,
      createdAt: iso(30),
    },
  ],
  SUPPORT: [
    {
      type: "CONTACT_MESSAGE_RECEIVED",
      title: "New contact message",
      message: "New contact message: Order arrived damaged",
      entityType: "contact_message",
      entityId: "88888888-8888-4888-8888-888888888801",
      isRead: false,
      createdAt: iso(2),
    },
    {
      type: "CONTACT_MESSAGE_RECEIVED",
      title: "New contact message",
      message: "New contact message: Question about delivery times",
      entityType: "contact_message",
      entityId: "88888888-8888-4888-8888-888888888802",
      isRead: true,
      createdAt: iso(26),
    },
  ],
  CUSTOMER: [
    {
      type: "ORDER_CONFIRMED",
      title: "Order confirmed",
      message: "Order ORD-1042 is now CONFIRMED.",
      entityType: "order",
      entityId: "33333333-3333-4333-8333-333333333301",
      isRead: false,
      createdAt: iso(4),
    },
    {
      type: "ORDER_CANCELLED",
      title: "Order cancelled",
      message: "Order ORD-1021 is now CANCELLED.",
      entityType: "order",
      entityId: "33333333-3333-4333-8333-333333333304",
      isRead: true,
      createdAt: iso(48),
    },
  ],
};

const notificationsByUser = new Map<string, NotificationItem[]>();
const preferencesByUser = new Map<string, Map<NotificationType, boolean>>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LATENCY = 40;

function currentUser() {
  return tokenStorage.getSession()?.user ?? null;
}

let seq = 0;
function seedFor(role: Role): NotificationItem[] {
  return SEEDS[role].map((seed) => {
    seq += 1;
    return {
      id: seed.id ?? `70000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
      type: seed.type,
      title: seed.title,
      message: seed.message,
      entityType: seed.entityType,
      entityId: seed.entityId,
      isRead: seed.isRead,
      readAt: seed.isRead ? seed.createdAt : null,
      createdAt: seed.createdAt,
    };
  });
}

function rowsFor(userId: string): NotificationItem[] {
  const existing = notificationsByUser.get(userId);
  if (existing) return existing;
  const user = currentUser();
  const seeded = user && user.id === userId ? seedFor(user.role) : [];
  notificationsByUser.set(userId, seeded);
  return seeded;
}

function preferencesFor(userId: string): Map<NotificationType, boolean> {
  const existing = preferencesByUser.get(userId);
  if (existing) return existing;
  const created = new Map<NotificationType, boolean>(NOTIFICATION_TYPES.map((type) => [type, true]));
  preferencesByUser.set(userId, created);
  return created;
}

function toPreferenceList(userId: string): NotificationPreference[] {
  const stored = preferencesFor(userId);
  return NOTIFICATION_TYPES.map((type) => ({ type, enabled: stored.get(type) ?? true }));
}

const notFound = () => new ApiError(404, "Notification not found", { serverMessage: "Notification not found" });

export const mockNotificationsApi: NotificationsApi = {
  async list(params) {
    await sleep(LATENCY);
    const user = currentUser();
    if (!user) {
      return { items: [], page: params.page, pageSize: params.pageSize, total: 0, totalPages: 0 };
    }

    const rows = rowsFor(user.id)
      .filter((n) => (params.unread === undefined ? true : n.isRead !== params.unread))
      .filter((n) => (params.type ? n.type === params.type : true))
      .sort((a, b) => {
        const field = params.sortBy ?? "createdAt";
        const order = a[field].localeCompare(b[field]) || a.id.localeCompare(b.id);
        return params.sortOrder === "asc" ? order : -order;
      });

    const start = (params.page - 1) * params.pageSize;
    return {
      items: rows.slice(start, start + params.pageSize).map((n) => ({ ...n })),
      page: params.page,
      pageSize: params.pageSize,
      total: rows.length,
      totalPages: Math.ceil(rows.length / params.pageSize),
    };
  },

  async unreadCount() {
    await sleep(LATENCY);
    const user = currentUser();
    if (!user) return 0;
    return rowsFor(user.id).filter((n) => !n.isRead).length;
  },

  async markRead(id) {
    await sleep(LATENCY);
    const user = currentUser();
    if (!user) throw notFound();
    const rows = rowsFor(user.id);
    const current = rows.find((n) => n.id === id);
    if (!current) throw notFound();
    const updated: NotificationItem = {
      ...current,
      isRead: true,
      readAt: current.readAt ?? new Date().toISOString(),
    };
    notificationsByUser.set(user.id, rows.map((n) => (n.id === id ? updated : n)));
    return { ...updated };
  },

  async markAllRead() {
    await sleep(LATENCY);
    const user = currentUser();
    if (!user) return 0;
    const rows = rowsFor(user.id);
    let updated = 0;
    const readAt = new Date().toISOString();
    notificationsByUser.set(
      user.id,
      rows.map((n) => {
        if (n.isRead) return n;
        updated += 1;
        return { ...n, isRead: true, readAt };
      }),
    );
    return updated;
  },

  async getPreferences() {
    await sleep(LATENCY);
    const user = currentUser();
    return user ? toPreferenceList(user.id) : [];
  },

  async updatePreferences(preferences: NotificationPreferenceInput[]) {
    await sleep(LATENCY);
    const user = currentUser();
    if (!user) return [];
    const stored = preferencesFor(user.id);
    for (const preference of preferences) {
      if (!NOTIFICATION_TYPES.includes(preference.type)) continue;
      stored.set(preference.type, preference.enabled);
    }
    return toPreferenceList(user.id);
  },
};

