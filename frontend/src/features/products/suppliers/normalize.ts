import type { Supplier, SupplierListParams, SupplierPage } from "./types";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export function normalizeSupplier(raw: unknown): Supplier {
  const r = isObject(raw) ? raw : {};
  const status = str(r.status)?.toLowerCase();
  return {
    id: (r.id as Supplier["id"]) ?? "",
    name: str(r.name) ?? "",
    contactPerson: str(r.contactPerson) ?? str(r.contact_person) ?? str(r.contact) ?? "",
    email: str(r.email) ?? "",
    phone: str(r.phone) ?? "",
    isActive:
      typeof r.isActive === "boolean" ? r.isActive : typeof r.is_active === "boolean" ? r.is_active : status ? status === "active" : true,
  };
}

export function matchesSearch(s: Supplier, search: string) {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return [s.name, s.contactPerson, s.email, s.phone].some((f) => f.toLowerCase().includes(q));
}

/**
 * Accepts either
 *   - a plain array (no server pagination → we filter + slice here), or
 *   - { items | data: [...], total | meta.total | pagination.total | count }  (server-paginated)
 */
export function toPage(body: unknown, params: SupplierListParams): SupplierPage {
  if (Array.isArray(body)) {
    const all = body.map(normalizeSupplier).filter((s) => matchesSearch(s, params.search));
    const start = (params.page - 1) * params.pageSize;
    return { items: all.slice(start, start + params.pageSize), total: all.length };
  }
  const b = isObject(body) ? body : {};
  const rawItems = Array.isArray(b.items) ? b.items : Array.isArray(b.data) ? b.data : [];
  const meta = isObject(b.meta) ? b.meta : {};
  const pagination = isObject(b.pagination) ? b.pagination : {};
  const items = rawItems.map(normalizeSupplier);
  const total = num(b.total) ?? num(meta.total) ?? num(pagination.total) ?? num(b.count) ?? items.length;
  return { items, total };
}
