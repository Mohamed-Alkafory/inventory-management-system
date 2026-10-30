import { useEffect, useRef, useState } from "react";
import { Search, ShieldCheck, ShieldOff, UserPen } from "lucide-react";
import Pagination from "../../components/ui/Pagination";
import RowActionsMenu from "../../components/ui/RowActionsMenu";
import type { MenuAction } from "../../components/ui/RowActionsMenu";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { useAuth } from "../../context/auth/useAuth";
import UserAvatar from "../../components/user/UserAvatar";
import { formatDate } from "../orders/format";
import { useDeactivateUser, useUpdateUser, useUsers } from "./hooks";
import { AccountStatusChip } from "./RoleBadge";
import RoleBadge from "./RoleBadge";
import UserFormDialog from "./UserFormDialog";
import type { AdminUser, UserListParams } from "./types";
import { ROLES, ROLE_LABELS } from "../../types/auth";

const PAGE_SIZE = 10;

const control =
  "h-9 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-[13px] text-[#111827] focus:border-[#FF5615] focus:outline-none focus:ring-2 focus:ring-[#FF5615]/25";

type ConfirmState =
  | { kind: "deactivate"; user: AdminUser }
  | { kind: "activate"; user: AdminUser }
  | null;

/**
 * Users management (ADMIN): searchable, paginated table with role pills,
 * account status and lifecycle actions — edit (role selection), and
 * deactivate/activate behind confirmations. Self-protection rules are
 * enforced server-side (no self deactivation / role change, last active
 * ADMIN always remains) and mirrored in the menu.
 */
export default function UsersList() {
  const { user: me } = useAuth();

  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [role, setRole] = useState<UserListParams["role"]>("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState<ConfirmState>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const deactivate = useDeactivateUser();
  const update = useUpdateUser();

  const params: UserListParams = { search, role, page, pageSize: PAGE_SIZE };
  const { data, isPending, isError, isFetching, refetch } = useUsers(params);

  const prevSearch = useRef({ search, role });
  useEffect(() => {
    const p = prevSearch.current;
    if (p.search !== search || p.role !== role) {
      prevSearch.current = { search, role };
      setPage(1);
    }
  }, [search, role]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) {
      queueMicrotask(() => setPage(totalPages));
    }
  }, [page, totalPages]);

  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  const filtered = !!(searchInput.trim() || role);

  const actionsFor = (u: AdminUser): MenuAction[] => {
    const isMe = u.id === me?.id;
    return [
      {
        label: "Edit user",
        icon: UserPen,
        onSelect: () => setEditing(u),
      },
      ...(u.isActive
        ? [
            // Self-deactivation (and taking down the last admin) is refused
            // with 422 by the API, so hide the item for my own row.
            ...(isMe
              ? []
              : [
                  {
                    label: "Deactivate account",
                    icon: ShieldOff,
                    danger: true,
                    onSelect: () => setConfirming({ kind: "deactivate", user: u }),
                  },
                ]),
          ]
        : [
            {
              label: "Re-activate account",
              icon: ShieldCheck,
              onSelect: () => setConfirming({ kind: "activate", user: u }),
            },
          ]),
    ];
  };

  const runConfirm = async () => {
    if (!confirming) return;
    setActionError(null);
    const { kind, user } = confirming;
    try {
      if (kind === "deactivate") {
        await deactivate.mutateAsync(user.id);
      } else {
        // Activation is just a PATCH with isActive: true (§3.2).
        await update.mutateAsync({ id: user.id, patch: { isActive: true } });
      }
      setConfirming(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search users"
            placeholder="Search by name or email…"
            className={`${control} w-full pl-9`}
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserListParams["role"])}
          aria-label="Filter by role"
          className={control}
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setRole("");
              setPage(1);
            }}
            className="h-9 text-[13px] font-semibold text-[#FF5615] hover:underline"
          >
            Clear filters
          </button>
        )}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="ms-auto inline-flex h-9 items-center gap-2 rounded-lg bg-[#FF5615] px-3.5 text-[13px] font-semibold text-white transition hover:bg-[#E74B0F]"
        >
          + New user
        </button>
      </div>

      {actionError && (
        <div role="alert" className="mt-3 rounded-control border border-danger-600/20 bg-danger-50 px-3 py-2 text-[13px] text-danger-700">
          {actionError}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        {isPending ? (
          <p role="status" className="p-10 text-center text-sm text-[#6B7280]">
            Loading users…
          </p>
        ) : isError ? (
          <div role="alert" className="p-10 text-center text-sm">
            <p className="text-[#DC2626]">Couldn’t load users.</p>
            <button type="button" onClick={() => refetch()} className="mt-2 font-semibold text-[#FF5615] hover:underline">
              Try again
            </button>
          </div>
        ) : data.items.length === 0 ? (
          <p className="p-10 text-center text-sm text-[#6B7280]">{filtered ? "No users match these filters." : "No users yet."}</p>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${isFetching ? "opacity-60" : ""}`} aria-busy={isFetching}>
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead className="bg-[#F8F8F8] text-[11px] font-semibold text-[#6B7280]">
                <tr>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Created</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {data.items.map((u) => (
                  <tr key={u.id} aria-current={u.id === me?.id ? "true" : undefined}>
                    <td className="px-4 py-2.5 font-semibold text-[#111827]">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={u.name} src={u.avatarUrl} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate">
                            {u.name}
                            {u.id === me?.id && <span className="ms-2 text-[11px] font-medium text-[#6B7280]">(you)</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[#374151]">{u.email}</td>
                    <td className="px-4 py-2.5">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-4 py-2.5">
                      <AccountStatusChip isActive={u.isActive} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-[#6B7280]">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end">
                        <RowActionsMenu label={`Actions for ${u.name}`} actions={actionsFor(u)} />
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
              Showing {first}–{last} of {total} {total === 1 ? "user" : "users"}
            </p>
            {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
          </div>
        )}
      </div>

      {(creating || editing) && <UserFormDialog user={editing} onClose={() => { setCreating(false); setEditing(null); }} />}

      <ConfirmDialog
        open={confirming !== null}
        title={confirming?.kind === "deactivate" ? "Deactivate this account?" : "Re-activate this account?"}
        description={
          confirming?.kind === "deactivate"
            ? `${confirming.user.name} will no longer be able to sign in, but the account data stays. You can re-activate it later.`
            : `${confirming?.user.name ?? "This user"} will be able to sign in again with the existing credentials.`
        }
        confirmLabel={confirming?.kind === "deactivate" ? "Deactivate" : "Re-activate"}
        tone={confirming?.kind === "deactivate" ? "danger" : "primary"}
        loading={deactivate.isPending}
        onConfirm={() => void runConfirm()}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
