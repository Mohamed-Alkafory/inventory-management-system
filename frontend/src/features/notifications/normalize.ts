import { NOTIFICATION_TYPES } from "./types";
import type {
  NotificationItem,
  NotificationPage,
  NotificationPreference,
  NotificationType,
} from "./types";

type Obj = Record<string, unknown>;

const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null;
const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v : undefined);

function readType(v: unknown): NotificationType {
  const raw = str(v)?.toUpperCase().trim();
  return NOTIFICATION_TYPES.find((t) => t === raw) ?? "SYSTEM";
}

/** Tolerant mapper for one GET /notifications row. */
export function normalizeNotification(raw: unknown): NotificationItem {
  const r: Obj = isObject(raw) ? raw : {};
  return {
    id: String(r.id ?? ""),
    type: readType(r.type),
    title: str(r.title) ?? "",
    message: str(r.message) ?? "",
    entityType: str(r.entityType) ?? str(r.entity_type) ?? null,
    entityId: str(r.entityId) ?? str(r.entity_id) ?? null,
    isRead: r.isRead === true || r.is_read === true,
    readAt: str(r.readAt) ?? str(r.read_at) ?? null,
    createdAt: str(r.createdAt) ?? str(r.created_at) ?? "",
  };
}

/** Mapper for the `{ data, meta }` list envelope (accepts a bare array too). */
export function toNotificationPage(body: unknown): NotificationPage {
  if (Array.isArray(body)) {
    return {
      items: body.map(normalizeNotification),
      page: 1,
      pageSize: body.length,
      total: body.length,
      totalPages: body.length > 0 ? 1 : 0,
    };
  }

  const b: Obj = isObject(body) ? body : {};
  const meta: Obj = isObject(b.meta) ? b.meta : {};
  const rawItems = Array.isArray(b.data) ? b.data : Array.isArray(b.items) ? b.items : [];
  const items = rawItems.map(normalizeNotification);
  const page = Number(meta.page ?? b.page ?? 1);
  const pageSize = Number(meta.limit ?? b.limit ?? b.pageSize ?? items.length);
  const total = Number(meta.total ?? b.total ?? items.length);
  const totalPages = Number(meta.totalPages ?? b.totalPages ?? (pageSize > 0 ? Math.ceil(total / pageSize) : 0));

  return {
    items,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : items.length,
    total: Number.isFinite(total) && total >= 0 ? total : items.length,
    totalPages: Number.isFinite(totalPages) && totalPages >= 0 ? totalPages : 0,
  };
}

/** Mapper for the bare preference array. */
export function toNotificationPreferences(body: unknown): NotificationPreference[] {
  if (!Array.isArray(body)) return [];
  return body.filter(isObject).map((row) => ({
    type: readType(row.type),
    enabled: row.enabled !== false,
  }));
}
