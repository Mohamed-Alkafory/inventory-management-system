import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { type ListAuditLogsQueryDto } from './dto/list-audit-logs.query.dto.js';

/**
 * Keys whose values must never reach the audit trail: passwords, hashes
 * (including `passwordHash`), tokens, secrets. Matched case-insensitively
 * against every object key at every depth (issue #34).
 */
const SENSITIVE_KEY = /pass(word)?|hash|token|secret/i;

/** A write target: the global client or the caller's transaction. */
type AuditWriter = Pick<Prisma.TransactionClient, 'auditLog'>;

/** One audit entry as produced by the instrumented services. */
export interface AuditLogEntry {
  /** Actor. `null`/omitted for system actions. */
  userId?: string | null;
  /** Dot-namespaced verb, e.g. `product.updated`, `order.cancelled`. */
  action: string;
  /** Logical entity: `product`, `stock_movement`, `order`, ... */
  entityType: string;
  entityId?: string | null;
  /** State before the mutation (omitted for creations). */
  oldValues?: unknown;
  /** State after the mutation. */
  newValues?: unknown;
}

/** Public `AuditLog` shape (contract §3.11) — never exposes the user row. */
export interface AuditLogResponse {
  id: string;
  userId: string | null;
  /** Actor snapshot (join) so the UI can show a name — null for system rows. */
  user: { id: string; name: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues: Prisma.JsonValue;
  newValues: Prisma.JsonValue;
  createdAt: Date;
}

export interface AuditLogListResponse {
  data: AuditLogResponse[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const AUDIT_LOG_SELECT = {
  id: true,
  userId: true,
  user: { select: { id: true, name: true } },
  action: true,
  entityType: true,
  entityId: true,
  oldValues: true,
  newValues: true,
  createdAt: true,
} satisfies Prisma.AuditLogSelect;

/**
 * Audit trail (issue #34).
 *
 * `log()` is deliberately **best effort**: it swallows every write error and
 * only emits a warning, so an audit failure can never abort the operation it
 * describes. Callers that already own a transaction pass it in, so the entry
 * commits (or rolls back) with the mutation itself.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persist one entry. Never throws — a failure is logged (without the
   * payload, which may contain business data) and the main flow continues.
   */
  async log(
    entry: AuditLogEntry,
    client: AuditWriter = this.prisma,
  ): Promise<void> {
    try {
      await client.auditLog.create({
        data: {
          userId: entry.userId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          oldValues: jsonOrDbNull(entry.oldValues),
          newValues: jsonOrDbNull(entry.newValues),
        },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'UnknownError';
      this.logger.warn(
        `Audit entry "${entry.action}" for ${entry.entityType} ${entry.entityId ?? '-'} could not be written (${reason}); the main operation was not affected`,
      );
    }
  }

  /**
   * `GET /audit-logs` — paginated, read-only listing. Every filter is an
   * exact match; `from`/`to` bound `createdAt` inclusively (ISO-8601). The
   * secondary `id` sort keeps tie ordering stable.
   */
  async findAll(query: ListAuditLogsQueryDto): Promise<AuditLogListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.AuditLogWhereInput = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
          { id: 'asc' },
        ] as Prisma.AuditLogOrderByWithRelationInput[],
        select: AUDIT_LOG_SELECT,
      }),
    ]);

    return {
      data: logs,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}

/** Prisma JSON input: `DbNull` when there is nothing to store. */
function jsonOrDbNull(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  const sanitized = sanitizeAuditValues(value);
  return sanitized === undefined
    ? Prisma.DbNull
    : (sanitized as Prisma.InputJsonValue);
}

/**
 * Recursively strip sensitive keys and normalize values to JSON. Exported
 * for the unit tests: the guarantee "no password hashes/tokens in
 * `oldValues`/`newValues`" is enforced here, once, for every caller.
 */
export function sanitizeAuditValues(
  value: unknown,
  seen: WeakSet<object> = new WeakSet<object>(),
): Prisma.JsonValue | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const type = typeof value;

  if (type === 'string' || type === 'boolean') {
    return value as string | boolean;
  }
  if (type === 'number') {
    return Number.isFinite(value as number) ? (value as number) : null;
  }
  if (type === 'bigint') {
    return String(value);
  }
  if (type === 'function' || type === 'symbol') {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditValues(item, seen) ?? null);
  }

  if (type === 'object') {
    // Prisma `Decimal` and similar wrappers expose a JSON representation.
    const jsonable = value as { toJSON?: unknown };
    if (typeof jsonable.toJSON === 'function') {
      return sanitizeAuditValues(jsonable.toJSON(), seen);
    }

    if (seen.has(value as object)) {
      return '[Circular]';
    }
    seen.add(value as object);

    const result: Record<string, Prisma.JsonValue> = {};
    for (const [key, item] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (SENSITIVE_KEY.test(key)) {
        continue;
      }
      const converted = sanitizeAuditValues(item, seen);
      if (converted !== undefined) {
        result[key] = converted;
      }
    }

    seen.delete(value as object);
    return result;
  }

  return undefined;
}

/** Exposed for tests: whether a key would be redacted. */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key);
}
