import { useState } from "react";
import { Pencil, Plus, Search, UserX } from "lucide-react";
import { useAuth } from "../../../context/auth/useAuth";
import Pagination from "../../../components/ui/Pagination";
import RowActionsMenu from "../../../components/ui/RowActionsMenu";
import { USE_MOCK } from "../../../features/products/suppliers/api";
import DeactivateSupplierDialog from "../../../features/products/suppliers/DeactivateSupplierDialog";
import { useSupplierPage } from "../../../features/products/suppliers/hooks";
import SupplierFormDialog from "../../../features/products/suppliers/SupplierFormDialog";
import type { Supplier } from "../../../features/products/suppliers/types";
import { useDebouncedValue } from "../../../lib/useDebouncedValue";

const PAGE_SIZE = 10;

type DialogState = { mode: "create" } | { mode: "edit"; supplier: Supplier } | null;

export default function Suppliers() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toDeactivate, setToDeactivate] = useState<Supplier | null>(null);

  const { data, isPending, isError, isFetching, refetch } = useSupplierPage({ search, page, pageSize: PAGE_SIZE });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // E.g. the last supplier on the last page was deactivated → step back one page.
  if (page > totalPages) setPage(totalPages);

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#111827]">Suppliers</h1>
          <p className="mt-1 text-sm text-[#6B7280]">Manage your suppliers and their information</p>
          {USE_MOCK && (
            <p className="mt-2 inline-block rounded-full bg-[#FFF1EB] px-2.5 py-1 text-[11px] font-semibold text-[#FF5615]">
              Demo data (mock API)
            </p>
          )}
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setDialog({ mode: "create" })}
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF5615] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#FF5615]/25 hover:bg-[#E84A0E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615] focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            Add Supplier
          </button>
        )}
      </div>

      <div className="relative mt-6 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1); // new search → back to the first page
          }}
          aria-label="Search suppliers"
          placeholder="Search suppliers…"
          className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white pl-9 pr-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#FF5615] focus:outline-none focus:ring-2 focus:ring-[#FF5615]/25"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
        {isPending ? (
          <p role="status" className="p-10 text-center text-sm text-[#6B7280]">
            Loading suppliers…
          </p>
        ) : isError ? (
          <div role="alert" className="p-10 text-center text-sm">
            <p className="text-[#DC2626]">Couldn’t load suppliers.</p>
            <button type="button" onClick={() => refetch()} className="mt-2 font-semibold text-[#FF5615] hover:underline">
              Try again
            </button>
          </div>
        ) : data.items.length === 0 ? (
          <p className="p-10 text-center text-sm text-[#6B7280]">
            {search.trim() ? `No suppliers match “${search.trim()}”.` : "No suppliers yet."}
          </p>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${isFetching ? "opacity-60" : ""}`} aria-busy={isFetching}>
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#F8F8F8] text-xs font-semibold text-[#6B7280]">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Contact Person</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Status</th>
                  {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {data.items.map((s) => (
                  <tr key={s.id} className={s.isActive ? "" : "text-[#9CA3AF]"}>
                    <td className="px-4 py-3 font-semibold text-[#111827]">{s.name}</td>
                    <td className="px-4 py-3 text-[#374151]">{s.contactPerson}</td>
                    <td className="px-4 py-3 text-[#6B7280]">{s.email}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#6B7280]">{s.phone}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          s.isActive ? "bg-[#DDF5EA] text-[#1F8F6B]" : "bg-[#F3F4F6] text-[#6B7280]"
                        }`}
                      >
                        {s.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <RowActionsMenu
                            label={`Actions for ${s.name}`}
                            actions={[
                              { label: "Edit", icon: Pencil, onSelect: () => setDialog({ mode: "edit", supplier: s }) },
                              ...(s.isActive
                                ? [{ label: "Deactivate", icon: UserX, danger: true, onSelect: () => setToDeactivate(s) }]
                                : []),
                            ]}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F3F4F6] px-4 py-3">
            <p className="text-xs text-[#6B7280]">
              Showing {from}–{to} of {total} {total === 1 ? "supplier" : "suppliers"}
            </p>
            {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
          </div>
        )}
      </div>

      <SupplierFormDialog
        open={dialog !== null}
        supplier={dialog?.mode === "edit" ? dialog.supplier : undefined}
        onClose={() => setDialog(null)}
      />
      <DeactivateSupplierDialog supplier={toDeactivate} onClose={() => setToDeactivate(null)} />
    </div>
  );
}
