import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Search } from "lucide-react";
import Pagination from "../../components/ui/Pagination";
import { useAuth } from "../../context/auth/useAuth";
import { ApiError } from "../../lib/http";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import ContactStatusBadge from "./ContactStatusBadge";
import { formatContactDate, messagePath } from "./format";
import { useContactMessages } from "./hooks";
import { CONTACT_STATUSES, CONTACT_STATUS_LABEL } from "./types";
import type { ContactStatus } from "./types";

const PAGE_SIZE = 10;

const control =
  "h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:border-[#FF5615] focus:outline-none focus:ring-2 focus:ring-[#FF5615]/25";

/**
 * Private support inbox. Filters map 1:1 to the backend query:
 * status, assignedToId (only the signed-in user — never GET /users) and search.
 */
export default function MessagesList() {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [status, setStatus] = useState<"" | ContactStatus>("");
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [page, setPage] = useState(1);

  const assignedToId = assignedToMe && user?.id ? user.id : "";
  const params = { status, assignedToId, search, page, pageSize: PAGE_SIZE };
  const { data, isPending, isError, error, isFetching, refetch } = useContactMessages(params);

  const messages = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = page > totalPages ? totalPages : page;
  if (currentPage !== page) setPage(currentPage);

  const first = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const last = Math.min(currentPage * PAGE_SIZE, total);
  const filtered = !!searchInput || !!status || assignedToMe;
  const forbidden = error instanceof ApiError && error.status === 403;

  return (
    <div className="text-ink">
      <div>
        <h1 className="text-2xl font-extrabold text-[#111827]">Messages</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Customer contact messages and support triage</p>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            aria-label="Search messages"
            placeholder="Search name, email or subject…"
            className={`${control} w-full pl-9`}
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "" | ContactStatus);
            setPage(1);
          }}
          aria-label="Filter by status"
          className={control}
        >
          <option value="">All statuses</option>
          {CONTACT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CONTACT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <label className="flex h-10 items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-[#374151]">
          <input
            type="checkbox"
            checked={assignedToMe}
            disabled={!user?.id}
            onChange={(e) => {
              setAssignedToMe(e.target.checked);
              setPage(1);
            }}
            aria-label="Assigned to me"
            className="size-4 accent-[#FF5615]"
          />
          Assigned to me
        </label>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setStatus("");
              setAssignedToMe(false);
              setPage(1);
            }}
            className="h-10 text-sm font-semibold text-[#FF5615] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
        {isPending ? (
          <p role="status" className="p-10 text-center text-sm text-[#6B7280]">
            Loading messages…
          </p>
        ) : isError ? (
          <div role="alert" className="p-10 text-center text-sm">
            <p className={forbidden ? "font-semibold text-[#111827]" : "text-[#DC2626]"}>
              {forbidden ? "You don’t have access to the support inbox." : "Couldn’t load messages."}
            </p>
            {!forbidden && (
              <button type="button" onClick={() => refetch()} className="mt-2 font-semibold text-[#FF5615] hover:underline">
                Try again
              </button>
            )}
          </div>
        ) : messages.length === 0 ? (
          <p className="p-10 text-center text-sm text-[#6B7280]">
            {filtered ? "No messages match these filters." : "No messages yet."}
          </p>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${isFetching ? "opacity-60" : ""}`} aria-busy={isFetching}>
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#F8F8F8] text-xs font-semibold text-[#6B7280]">
                <tr>
                  <th className="px-4 py-3">Sender</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assignee</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {messages.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#111827]">{m.name || "—"}</p>
                      <p className="text-xs text-[#6B7280]">{m.email}</p>
                    </td>
                    <td className="px-4 py-3 text-[#374151]">
                      <Link to={messagePath(m.id)} className="font-semibold text-[#111827] hover:text-[#FF5615] hover:underline">
                        {m.subject || "(no subject)"}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <ContactStatusBadge status={m.status} />
                    </td>
                    <td className="px-4 py-3 text-[#374151]">{m.assignedTo?.name || "Unassigned"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#6B7280]">{formatContactDate(m.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Link
                          to={messagePath(m.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#FF5615] hover:bg-[#FFF3EC]"
                        >
                          <Eye className="size-3.5" aria-hidden="true" />
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F3F4F6] px-4 py-3">
            <p className="text-xs text-[#6B7280]">
              Showing {first}–{last} of {total} {total === 1 ? "message" : "messages"}
            </p>
            {totalPages > 1 && <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />}
          </div>
        )}
      </div>
    </div>
  );
}
