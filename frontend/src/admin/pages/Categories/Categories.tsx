import { useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import Pagination from "../../../components/ui/Pagination";
import { useAuth } from "../../../context/auth/useAuth";
import { USE_MOCK } from "../../../features/products/categories/api";
import CategoryFormDialog from "../../../features/products/categories/CategoryFormDialog";
import DeleteCategoryDialog from "../../../features/products/categories/DeleteCategoryDialog";
import { useCategoryPage } from "../../../features/products/categories/hooks";
import type { Category } from "../../../features/products/categories/types";
import { useDebouncedValue } from "../../../lib/useDebouncedValue";

const PAGE_SIZE = 10;

type DialogState = { mode: "create" } | { mode: "edit"; category: Category } | null;

export default function Categories() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toDelete, setToDelete] = useState<Category | null>(null);

  const { data, isPending, isError, isFetching, refetch } = useCategoryPage({ search, page, pageSize: PAGE_SIZE });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // E.g. the last item of the last page was deleted → step back one page.
  if (page > totalPages) setPage(totalPages);

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#111827]">Categories</h1>
          <p className="mt-1 text-sm text-[#6B7280]">Organize your products into categories</p>
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
            Add Category
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
          aria-label="Search categories"
          placeholder="Search categories…"
          className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white pl-9 pr-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#FF5615] focus:outline-none focus:ring-2 focus:ring-[#FF5615]/25"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
        {isPending ? (
          <p role="status" className="p-10 text-center text-sm text-[#6B7280]">
            Loading categories…
          </p>
        ) : isError ? (
          <div role="alert" className="p-10 text-center text-sm">
            <p className="text-[#DC2626]">Couldn’t load categories.</p>
            <button type="button" onClick={() => refetch()} className="mt-2 font-semibold text-[#FF5615] hover:underline">
              Try again
            </button>
          </div>
        ) : data.items.length === 0 ? (
          <p className="p-10 text-center text-sm text-[#6B7280]">
            {search.trim() ? `No categories match “${search.trim()}”.` : "No categories yet."}
          </p>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${isFetching ? "opacity-60" : ""}`} aria-busy={isFetching}>
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-[#F8F8F8] text-xs font-semibold text-[#6B7280]">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Products</th>
                  {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {data.items.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-semibold text-[#111827]">{c.name}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs font-semibold text-[#374151]">
                        {c.productCount}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setDialog({ mode: "edit", category: c })}
                            aria-label={`Edit ${c.name}`}
                            className="rounded-md p-2 text-[#6B7280] hover:bg-[#FFF1EB] hover:text-[#FF5615] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615]"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setToDelete(c)}
                            aria-label={`Delete ${c.name}`}
                            className="rounded-md p-2 text-[#6B7280] hover:bg-[#FEF2F2] hover:text-[#DC2626] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
              Showing {from}–{to} of {total} {total === 1 ? "category" : "categories"}
            </p>
            {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
          </div>
        )}
      </div>

      <CategoryFormDialog
        open={dialog !== null}
        category={dialog?.mode === "edit" ? dialog.category : undefined}
        onClose={() => setDialog(null)}
      />
      <DeleteCategoryDialog category={toDelete} onClose={() => setToDelete(null)} />
    </div>
  );
}
