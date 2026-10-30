import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { History, ScrollText } from "lucide-react";
import Pagination from "../../components/ui/Pagination";
import { formatDateTime } from "../orders/format";
import { entityLink } from "./api";
import AuditRowDetails from "./AuditRowDetails";
import { useAuditLogs } from "./hooks";
import { ENTITY_TYPES, actionsFor, humanizeAction } from "./status";
import type { AuditListParams, AuditLog } from "./types";
import RoleBadge from "../users/RoleBadge";
import { useUsers } from "../users/hooks";
import { ROLE_LABELS } from "../../types/auth";

const PAGE_SIZE = 10;

const control =
  "h-9 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-[13px] text-[#111827] focus:border-[#FF5615] focus:outline-none focus:ring-2 focus:ring-[#FF5615]/25";

/**
 * "Who changed what" (ADMIN): filterable, paginated read-only audit trail.
 * Filters combine freely (user + entity + action + an inclusive date
 * range); rows carry date, actor, action, entity link and a details
 * dialog showing old vs new values side by side.
 */
export default function AuditList() {
  const [userId, setUserId] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [details, setDetails] = useState<AuditLog | null>(null);

  // Actor dropdown (ADMIN-only page, so the /users list is reachable).
  const users = useUsers({ search: "", role: "", page: 1, pageSize: 100 });
  // Audit rows only join { id, name }; the role comes from the users list.
  const roleByUserId = new Map((users.data?.items ?? []).map((u) => [u.id, u.role]));

  const params: AuditListParams = { userId, entityType, action, from, to, page, pageSize: PAGE_SIZE };
  const { data, isPending, isError, isFetching, refetch } = useAuditLogs(params);

  const prevSearch = useRef({ userId, entityType, action, from, to });
  useEffect(() => {
    const p = prevSearch.current;
    if (p.userId !== userId || p.entityType !== entityType || p.action !== action || p.from !== from || p.to !== to) {
      prevSearch.current = { userId, entityType, action, from, to };
      setPage(1);
    }
  }, [userId, entityType, action, from, to]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) {
      queueMicrotask(() => setPage(totalPages));
    }
  }, [page, totalPages]);

  const from_ = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to_ = Math.min(page * PAGE_SIZE, total);
  const filtered = !!(userId || entityType || action || from || to);

  const clearFilters = () => {
    setUserId("");
    setEntityType("");
    setAction("");
    setFrom("");
    setTo("");
    setPage(1);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        <select
          value={userId}
          onChange={(e) => {
            setUserId(e.target.value);
            setAction("");
          }}
          aria-label="Filter by user"
          className={`${control} max-w-56`}
        >
          <option value="">All users</option>
          {users.data?.items.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({ROLE_LABELS[u.role]})
            </option>
          ))}
        </select>
        <select
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setAction("");
          }}
          aria-label="Filter by entity type"
          className={control}
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          aria-label="Filter by action"
          className={control}
        >
          {actionsFor(entityType).map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-[#6B7280]">
          From
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className={control}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-[#6B7280]">
          To
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className={control}
          />
        </label>
        {filtered && (
          <button type="button" onClick={clearFilters} className="h-9 text-[13px] font-semibold text-[#FF5615] hover:underline">
            Clear filters
          </button>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        {isPending ? (
          <p role="status" className="p-10 text-center text-sm text-[#6B7280]">
            Loading audit trail…
          </p>
        ) : isError ? (
          <div role="alert" className="p-10 text-center text-sm">
            <p className="text-[#DC2626]">Couldn’t load the audit trail.</p>
            <button type="button" onClick={() => refetch()} className="mt-2 font-semibold text-[#FF5615] hover:underline">
              Try again
            </button>
          </div>
        ) : data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <ScrollText className="h-8 w-8 text-[#D1D5DB]" aria-hidden="true" />
            <p className="text-sm font-medium text-[#374151]">{filtered ? "No audit entries match these filters." : "No audit entries yet."}</p>
            {!filtered && <p className="text-sm text-[#6B7280]">Admin actions are recorded here automatically.</p>}
          </div>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${isFetching ? "opacity-60" : ""}`} aria-busy={isFetching}>
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead className="bg-[#F8F8F8] text-[11px] font-semibold text-[#6B7280]">
                <tr>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">User</th>
                  <th className="px-4 py-2.5">Action</th>
                  <th className="px-4 py-2.5">Entity</th>
                  <th className="px-4 py-2.5 text-right">Old / new values</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {data.items.map((log) => {
                  const link = entityLink(log.entityType, log.entityId);
                  const actorRole = log.userId ? roleByUserId.get(log.userId) : undefined;
                  return (
                    <tr key={log.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-2.5 text-[#6B7280]">{formatDateTime(log.createdAt)}</td>
                      <td className="px-4 py-2.5 font-medium text-[#111827]">
                        <span className="flex flex-wrap items-center gap-2">
                          <span>{log.userName ?? "System"}</span>
                          {actorRole && <RoleBadge role={actorRole} />}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="rounded-full bg-[#FFF1EB] px-2 py-0.5 text-[11px] font-semibold text-[#FF5615]">
                          {humanizeAction(log.action)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[#374151]">
                        {link ? (
                          <Link to={link} className="font-medium text-[#FF5615] hover:underline">
                            {log.entityId}
                          </Link>
                        ) : (
                          <span className="text-[#9CA3AF]">{log.entityId ?? "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setDetails(log)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-[#FF5615] transition hover:bg-[#FFF1EB]"
                        >
                          <History className="h-3.5 w-3.5" aria-hidden="true" />
                          Before / after
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F3F4F6] px-4 py-3">
            <p className="text-xs text-[#6B7280]">
              Showing {from_}–{to_} of {total} {total === 1 ? "entry" : "entries"}
            </p>
            {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
          </div>
        )}
      </div>

      {details && <AuditRowDetails log={details} onClose={() => setDetails(null)} />}
    </div>
  );
}
