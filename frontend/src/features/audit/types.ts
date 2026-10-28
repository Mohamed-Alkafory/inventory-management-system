export type Id = string;

/** One read-only audit trail row (§3.11). */
export interface AuditLog {
  id: Id;
  /** Actor id — null for rows the system wrote without a session. */
  userId: string | null;
  /** Joined snapshot so the UI shows a name without extra requests. */
  userName: string | null;
  /** Dot-namespace verb, e.g. "user.updated", "purchase_order.received". */
  action: string;
  /** Logical entity: "user", "product", "order", ... */
  entityType: string;
  entityId: string | null;
  /** Pre-mutation state (null for creations). Sensitive keys are redacted. */
  oldValues: Record<string, unknown> | null;
  /** Post-mutation state. */
  newValues: Record<string, unknown> | null;
  /** ISO date-time. */
  createdAt: string;
}

export interface AuditListParams {
  /** Actor filter — "" = everyone. */
  userId: string;
  /** Entity filter — "" = all types. */
  entityType: string;
  /** Exact action filter — "" = all actions. */
  action: string;
  /** Inclusive lower bound on createdAt, "YYYY-MM-DD" or "". */
  from: string;
  /** Inclusive upper bound, "YYYY-MM-DD" or "". */
  to: string;
  page: number;
  pageSize: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
}

export interface AuditApi {
  list(params: AuditListParams): Promise<Paged<AuditLog>>;
}
