import type { AuthSession, AuthTokens, Role, User } from "../types/auth";
import { isRole } from "../types/auth";
import { ApiError } from "./errors";

/*
  Backend response → app types.
  Tolerant on purpose (camelCase or snake_case, role in any case), so the
  frontend keeps working if the backend contract shifts slightly.
  Tighten this once the real endpoints are final.
*/

type Dict = Record<string, unknown>;

const isDict = (v: unknown): v is Dict => typeof v === "object" && v !== null;
const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined);

function badShape(what: string): never {
  throw new ApiError(`Unexpected ${what} response from the server.`);
}

export function toRole(value: unknown): Role {
  const role = typeof value === "string" ? value.toUpperCase().replace(/^ROLE_/, "") : "";
  if (isRole(role)) return role;
  // Never coerce an unknown role to a known one: fail the session instead.
  return badShape("role");
}

export function toUser(data: unknown): User {
  const raw = isDict(data) && isDict(data.user) ? data.user : data;
  if (!isDict(raw)) return badShape("user");

  const id = raw.id ?? raw._id;
  const email = str(raw.email);
  if ((typeof id !== "string" && typeof id !== "number") || !email) return badShape("user");

  return {
    id: String(id),
    email,
    name: str(raw.name) ?? str(raw.fullName) ?? str(raw.full_name) ?? email.split("@")[0],
    role: toRole(raw.role),
    avatarUrl: str(raw.avatarUrl) ?? str(raw.avatar_url) ?? null,
    ...(str(raw.createdAt) ?? str(raw.created_at) ? { createdAt: str(raw.createdAt) ?? str(raw.created_at) } : {}),
  };
}

export function toTokens(data: unknown): AuthTokens {
  if (!isDict(data)) return badShape("token");
  const source = isDict(data.tokens) ? data.tokens : data;

  const accessToken = str(source.accessToken) ?? str(source.access_token) ?? str(source.token);
  if (!accessToken) return badShape("token");

  return {
    accessToken,
    refreshToken: str(source.refreshToken) ?? str(source.refresh_token),
  };
}

export function toAuthSession(data: unknown): AuthSession {
  return { user: toUser(data), tokens: toTokens(data) };
}
