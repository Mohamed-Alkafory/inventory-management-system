import { CONTACT_STATUSES } from "./types";
import type { ContactAssignee, ContactMessage, ContactPage, ContactStatus } from "./types";

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null;
const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v : undefined);
const arr = (...c: unknown[]): unknown[] => (c.find(Array.isArray) as unknown[] | undefined) ?? [];

export function readContactStatus(v: unknown): ContactStatus {
  const raw = str(v)?.toUpperCase().trim();
  return CONTACT_STATUSES.find((s) => s === raw) ?? "NEW";
}

function readAssignee(v: unknown): ContactAssignee | null {
  if (!isObject(v)) return null;
  const id = str(v.id);
  const name = str(v.name);
  if (!id && !name) return null;
  return { id: id ?? "", name: name ?? "", email: str(v.email), role: str(v.role) };
}

/** Tolerant mapper for GET /contact-messages and GET /contact-messages/:id. */
export function normalizeContactMessage(raw: unknown): ContactMessage {
  const r: Obj = isObject(raw) ? raw : {};
  const assignedTo = readAssignee(r.assignedTo ?? r.assigned_to);
  return {
    id: String(r.id ?? ""),
    name: str(r.name) ?? "",
    email: str(r.email) ?? "",
    subject: str(r.subject) ?? "",
    message: str(r.message) ?? "",
    status: readContactStatus(r.status),
    assignedToId: str(r.assignedToId) ?? str(r.assigned_to_id) ?? assignedTo?.id ?? null,
    assignedTo,
    internalNote: typeof r.internalNote === "string" ? r.internalNote : typeof r.internal_note === "string" ? r.internal_note : null,
    createdAt: str(r.createdAt) ?? str(r.created_at) ?? "",
    updatedAt: str(r.updatedAt) ?? str(r.updated_at) ?? "",
  };
}

/** Total from `{ data | items, meta.total | total }`, or a plain array. */
export function toContactPage(body: unknown): ContactPage {
  if (Array.isArray(body)) {
    return { items: body.map(normalizeContactMessage), total: body.length };
  }
  const b: Obj = isObject(body) ? body : {};
  const meta: Obj = isObject(b.meta) ? b.meta : {};
  const items = arr(b.data, b.items).map(normalizeContactMessage);
  const total = Number(b.total ?? meta.total ?? items.length);
  return { items, total: Number.isFinite(total) ? total : items.length };
}
