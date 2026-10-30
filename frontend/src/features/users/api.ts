import { request } from "../../lib/http";
import { isRole } from "../../types/auth";
import type { AdminUser, CreateUserInput, UsersApi } from "./types";

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null;
const str = (v: unknown) => (typeof v === "string" ? v : "");

export function normalizeUser(raw: unknown): AdminUser {
  const r: Obj = isObject(raw) ? raw : {};
  const role = str(r.role).toUpperCase().replace(/^ROLE_/, "");
  // Never silently remap a role: unknown values are a contract error.
  if (!isRole(role)) {
    throw new Error(`Unknown user role: ${str(r.role) || "(missing)"}`);
  }

  return {
    id: str(r.id),
    name: str(r.name),
    email: str(r.email),
    role,
    isActive: typeof r.isActive === "boolean" ? r.isActive : true,
    avatarUrl: typeof r.avatarUrl === "string" && r.avatarUrl.length > 0 ? r.avatarUrl : null,
    createdAt: str(r.createdAt),
  };
}

function unpack(body: unknown): { items: AdminUser[]; total: number } {
  const b: Obj = isObject(body) ? body : {};
  const meta: Obj = isObject(b.meta) ? b.meta : {};
  const items = Array.isArray(b.data) ? b.data.map(normalizeUser) : [];
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  return { items, total: num(b.total) ?? num(meta.total) ?? items.length };
}

/**
 * ► CONNECTING THE REAL API — /users is merged and ADMIN-only on the
 * backend (RolesGuard), so the UI talks to it directly when the admin is
 * signed in; STAFF requests 403 and the route is gated before that too.
 */
export const usersApi: UsersApi = {
  async list(p) {
    const q = new URLSearchParams({ page: String(p.page), limit: String(p.pageSize) });
    if (p.search.trim()) q.set("search", p.search.trim());
    if (p.role) q.set("role", p.role);
    return unpack(await request<unknown>(`/users?${q.toString()}`));
  },

  async create(input: CreateUserInput) {
    return normalizeUser(
      await request<unknown>("/users", {
        method: "POST",
        body: JSON.stringify({ name: input.name, email: input.email, password: input.password, role: input.role }),
      }),
    );
  },

  async update(id, patch) {
    return normalizeUser(
      await request<unknown>(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    );
  },

  /** DELETE answers 204 No Content. Reactivating goes through PATCH isActive:true. */
  async deactivate(id) {
    await request<unknown>(`/users/${id}`, { method: "DELETE" });
  },
};
