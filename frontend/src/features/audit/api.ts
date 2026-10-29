import { request } from "../../lib/http";
import type { AuditApi, AuditLog, AuditListParams, Paged } from "./types";

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null;
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Only plain object payloads can be shown as old/new values. */
function asValues(v: unknown): Record<string, unknown> | null {
  return isObject(v) ? v : null;
}

export function normalizeAuditLog(raw: unknown): AuditLog {
  const r: Obj = isObject(raw) ? raw : {};
  const user: Obj = isObject(r.user) ? r.user : {};
  return {
    id: str(r.id),
    userId: str(r.userId) || null,
    userName: str(user.name) || null,
    action: str(r.action),
    entityType: str(r.entityType),
    entityId: str(r.entityId) || null,
    oldValues: asValues(r.oldValues),
    newValues: asValues(r.newValues),
    createdAt: str(r.createdAt),
  };
}

function unpack(body: unknown): Paged<AuditLog> {
  const b: Obj = isObject(body) ? body : {};
  const meta: Obj = isObject(b.meta) ? b.meta : {};
  const items = (Array.isArray(b.data) ? (b.data as unknown[]) : []).map(normalizeAuditLog);
  const raw = typeof b.total === "number" ? b.total : typeof meta.total === "number" ? meta.total : items.length;
  return { items, total: raw as number };
}

/** Timestamps must be full ISO bounds (contract example: …T00:00:00.000Z). */
const dayBounds = {
  from: (day: string) => (day ? new Date(`${day}T00:00:00`).toISOString() : undefined),
  to: (day: string) => (day ? new Date(`${day}T23:59:59.999`).toISOString() : undefined),
};

/**
 * ► CONNECTING THE REAL API — GET /audit-logs is merged and ADMIN-only;
 * every filter is an exact match and from/to bound createdAt inclusively.
 */
export const auditApi: AuditApi = {
  async list(p: AuditListParams) {
    const q = new URLSearchParams({ page: String(p.page), limit: String(p.pageSize) });
    if (p.userId) q.set("userId", p.userId);
    if (p.entityType) q.set("entityType", p.entityType);
    if (p.action) q.set("action", p.action);
    const from = dayBounds.from(p.from);
    const to = dayBounds.to(p.to);
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return unpack(await request<unknown>(`/audit-logs?${q.toString()}`));
  },
};

/** Where an audit row can link the admin to the entity it touched (null = nowhere). */
export function entityLink(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null;
  switch (entityType) {
    case "product":
      return `/products/${entityId}`;
    case "order":
      return `/orders/${entityId}`;
    case "purchase_order":
      return `/admin/purchase-orders/${entityId}`;
    default:
      // "user" and "stock_movement" have no single-entity detail page.
      return null;
  }
}
