import type { Role } from "../../types/auth";

/** Same four roles as the auth model — one shared union. */
export type UserRole = Role;
export type Id = string;

/** §3.1 `User` shape — the API never returns password hashes. */
export interface AdminUser {
  id: Id;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  /** Backend-relative `/uploads/avatars/...` path or an external URL. */
  avatarUrl?: string | null;
  /** ISO date-time. */
  createdAt: string;
}

export interface UserListParams {
  search: string;
  /** "" = all roles. */
  role: "" | UserRole;
  /** 1-based. */
  page: number;
  pageSize: number;
}

/** POST /users — a password is required once, at creation. */
export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

/** PATCH /users/:id — every field optional (activate = { isActive: true }). */
export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface Paged<T> {
  items: T[];
  total: number;
}

export interface UsersApi {
  list(params: UserListParams): Promise<Paged<AdminUser>>;
  create(input: CreateUserInput): Promise<AdminUser>;
  update(id: Id, patch: UpdateUserInput): Promise<AdminUser>;
  /** Soft delete: isActive=false (the row stays). */
  deactivate(id: Id): Promise<void>;
}
