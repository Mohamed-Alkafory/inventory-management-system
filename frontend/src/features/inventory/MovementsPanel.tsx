import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import Pagination from "../../components/ui/Pagination";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { useMovements } from "./hooks";
import type { Id, MovementListParams } from "./types";

const PAGE_SIZE = 10;
import { formatChange } from "./formatChange";

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

const control =
  "h-9 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:border-[#FF5615] focus:outline-none focus:ring-2 focus:ring-[#FF5615]/25";

/** Movement history. Pass `productId` for one product, omit it for the global history. */
export default function MovementsPanel({ productId }: { productId?: Id }) {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [type, setType] = useState<MovementListParams["type"]>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const { data, isPending, isError, isFetching, refetch } = useMovements({ productId, search, type, from, to, page, pageSize: PAGE_SIZE });

  const prevFilters = useRef({ search, type, from, to });
  useEffect(() => {
    const p = prevFilters.current;
    if (p.search !== search || p.type !== type || p.from !== from || p.to !== to) {
      prevFilters.current = { search, type, from, to };
      setPage(1);
    }
  }, [search, type, from, to]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) {
      queueMicrotask(() => setPage(totalPages));
    }
  }, [page, totalPages]);

  const from1 = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to1 = Math.min(page * PAGE_SIZE, total);
  const filtered = !!(searchInput || type || from || to);
  const global = productId === undefined;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        {global && (
          <div className="relative min-w-52 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search movements"
              placeholder="Search product, SKU or reason…"
              className={`${control} w-full pl-9`}
            />
          </div>
        )}
        <select value={type} onChange={(e) => setType(e.target.value as MovementListParams["type"])} aria-label="Movement type" className={control}>
          <option value="">All movements</option>
          <option value="increase">Stock added</option>
          <option value="decrease">Stock removed</option>
        </select>
        <label className="flex items-center gap-2 text-xs font-semibold text-[#6B7280]">
          From
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={control} />
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold text-[#6B7280]">
          To
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={control} />
        </label>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setType("");
              setFrom("");
              setTo("");
            }}
            className="h-9 text-sm font-semibold text-[#FF5615] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
        {isPending ? (
          <p role="status" className="p-10 text-center text-sm text-[#6B7280]">
            Loading movements…
          </p>
        ) : isError ? (
          <div role="alert" className="p-10 text-center text-sm">
            <p className="text-[#DC2626]">Couldn’t load the history.</p>
            <button type="button" onClick={() => refetch()} className="mt-2 font-semibold text-[#FF5615] hover:underline">
              Try again
            </button>
          </div>
        ) : data.items.length === 0 ? (
          <p className="p-10 text-center text-sm text-[#6B7280]">{filtered ? "No movements match these filters." : "No stock movements yet."}</p>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${isFetching ? "opacity-60" : ""}`} aria-busy={isFetching}>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-[#F8F8F8] text-xs font-semibold text-[#6B7280]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  {global && <th className="px-4 py-3">Product</th>}
                  <th className="px-4 py-3">Change</th>
                  <th className="px-4 py-3">Stock after</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {data.items.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-[#6B7280]">{m.createdAt ? dateFmt.format(new Date(m.createdAt)) : "—"}</td>
                    {global && (
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#111827]">{m.productName}</p>
                        <p className="text-xs text-[#6B7280]">{m.sku}</p>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${m.change > 0 ? "bg-[#DDF5EA] text-[#1F8F6B]" : "bg-[#FFD6D8] text-[#C53030]"}`}>
                        {formatChange(m.change)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#374151]">{m.stockAfter ?? "—"}</td>
                    <td className="px-4 py-3 text-[#374151]">{m.reason}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#6B7280]">{m.createdBy || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F3F4F6] px-4 py-3">
            <p className="text-xs text-[#6B7280]">
              Showing {from1}–{to1} of {total} {total === 1 ? "movement" : "movements"}
            </p>
            {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
          </div>
        )}
      </div>
    </div>
  );
}
