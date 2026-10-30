import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpDown, History, PackagePlus, Search } from "lucide-react";
import Pagination from "../../components/ui/Pagination";
import RowActionsMenu from "../../components/ui/RowActionsMenu";
import { useAuth } from "../../context/auth/useAuth";
import { can } from "../../lib/permissions";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { resolveImageUrl } from "../../lib/imageUrl";
import AdjustStockDialog from "./AdjustStockDialog";
import { useInventory, useInventoryCategories } from "./hooks";
import ProductHistoryDialog from "./ProductHistoryDialog";
import { STATUSES, STATUS_LABEL } from "./status";
import StatusChip from "./StatusChip";
import type { InventoryItem, InventoryListParams } from "./types";

const PAGE_SIZE = 10;

const control =
  "h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:border-[#FF5615] focus:outline-none focus:ring-2 focus:ring-[#FF5615]/25";

export default function StockLevels() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const canAdjust = can(role, "stock.adjust");
  const canReorder = can(role, "po.create");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<InventoryListParams["status"]>("");
  const [page, setPage] = useState(1);
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  const [history, setHistory] = useState<InventoryItem | null>(null);

  const categories = useInventoryCategories();
  const { data, isPending, isError, isFetching, refetch } = useInventory({ search, categoryId, status, page, pageSize: PAGE_SIZE });

  const prevFilters = useRef({ search, categoryId, status });
  useEffect(() => {
    const p = prevFilters.current;
    if (p.search !== search || p.categoryId !== categoryId || p.status !== status) {
      prevFilters.current = { search, categoryId, status };
      setPage(1);
    }
  }, [search, categoryId, status]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) {
      queueMicrotask(() => setPage(totalPages));
    }
  }, [page, totalPages]);

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const filtered = !!(search.trim() || categoryId || status);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search products"
            placeholder="Search products…"
            className={`${control} w-full pl-9`}
          />
        </div>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Filter by category" className={control}>
          <option value="">All Categories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as InventoryListParams["status"])} aria-label="Filter by status" className={control}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
        {isPending ? (
          <p role="status" className="p-10 text-center text-sm text-[#6B7280]">
            Loading inventory…
          </p>
        ) : isError ? (
          <div role="alert" className="p-10 text-center text-sm">
            <p className="text-[#DC2626]">Couldn’t load inventory.</p>
            <button type="button" onClick={() => refetch()} className="mt-2 font-semibold text-[#FF5615] hover:underline">
              Try again
            </button>
          </div>
        ) : data.items.length === 0 ? (
          <p className="p-10 text-center text-sm text-[#6B7280]">{filtered ? "No products match these filters." : "No products yet."}</p>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${isFetching ? "opacity-60" : ""}`} aria-busy={isFetching}>
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#F8F8F8] text-xs font-semibold text-[#6B7280]">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Current Stock</th>
                  <th className="px-4 py-3">Reorder Point</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {data.items.map((i) => {
                  const imageSrc = resolveImageUrl(i.imageUrl);
                  return (
                  <tr key={i.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {imageSrc ? (
                          <img src={imageSrc} alt="" className="h-9 w-9 rounded-lg object-cover" />
                        ) : (
                          <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFF1EB] text-sm font-bold text-[#FF5615]">
                            {i.name.charAt(0)}
                          </span>
                        )}
                        <span className="font-semibold text-[#111827]">{i.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#6B7280]">{i.sku}</td>
                    <td className="px-4 py-3 text-[#6B7280]">{i.categoryName || "—"}</td>
                    <td
                      className={`px-4 py-3 font-semibold ${
                        i.status === "out_of_stock" ? "text-[#DC2626]" : i.status === "low_stock" ? "text-[#FF5615]" : "text-[#111827]"
                      }`}
                    >
                      {i.currentStock}
                    </td>
                    <td className="px-4 py-3 text-[#6B7280]">{i.reorderPoint}</td>
                    <td className="px-4 py-3">
                      <StatusChip status={i.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <RowActionsMenu
                          label={`Actions for ${i.name}`}
                          actions={[
                            ...(canAdjust
                              ? [{ label: "Adjust stock", icon: ArrowUpDown, onSelect: () => setAdjusting(i) }]
                              : []),
                            { label: "View history", icon: History, onSelect: () => setHistory(i) },
                            // Reorder only makes sense when the stock ran low — it opens
                            // a purchase-order draft with this product pre-filled. Only
                            // roles that may create POs (ADMIN) see it.
                            ...(canReorder && (i.status === "low_stock" || i.status === "out_of_stock")
                              ? [
                                  {
                                    label: "Reorder from supplier",
                                    icon: PackagePlus,
                                    onSelect: () =>
                                      navigate("/admin/purchase-orders", {
                                        state: {
                                          reorderProduct: {
                                            productId: i.id,
                                            name: i.name,
                                            sku: i.sku,
                                            quantity: Math.max(1, i.reorderPoint - i.currentStock),
                                          },
                                        },
                                      }),
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </div>
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
              Showing {from}–{to} of {total} {total === 1 ? "product" : "products"}
            </p>
            {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
          </div>
        )}
      </div>

      <AdjustStockDialog item={adjusting} onClose={() => setAdjusting(null)} />
      <ProductHistoryDialog item={history} onClose={() => setHistory(null)} />
    </div>
  );
}
