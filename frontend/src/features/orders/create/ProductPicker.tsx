import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useDebouncedValue } from "../../../lib/useDebouncedValue";
import { formatMoney } from "../format";
import { useProductSearch } from "./hooks";
import type { DraftLine, PickerProduct } from "./types";

function Availability({ stock, remaining }: { stock: number | null; remaining: number | null }) {
  if (stock === null || remaining === null) return null;
  const [label, style] =
    stock === 0
      ? ["Out of stock", "bg-[#FFD6D8] text-[#C53030]"]
      : remaining === 0
        ? [`All ${stock} are in this order`, "bg-[#FFEAB6] text-[#B7791F]"]
        : remaining <= 5
          ? [`Only ${remaining} left`, "bg-[#FFEAB6] text-[#B7791F]"]
          : [`${remaining} available`, "bg-[#DDF5EA] text-[#1F8F6B]"];
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{label}</span>;
}

export default function ProductPicker({
  lines,
  onAdd,
  onFresh,
}: {
  lines: DraftLine[];
  onAdd: (p: PickerProduct) => void;
  /** Called whenever fresh stock numbers arrive, so lines already in the order stay up to date. */
  onFresh: (products: PickerProduct[]) => void;
}) {
  const [input, setInput] = useState("");
  const search = useDebouncedValue(input, 250);
  const { data, isPending, isError, isFetching, refetch } = useProductSearch(search);

  useEffect(() => {
    if (data && !isFetching) onFresh(data);
  }, [data, isFetching, onFresh]);

  return (
    <section aria-labelledby="picker-h" className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
      <h2 id="picker-h" className="text-base font-bold text-[#111827]">
        Add products
      </h2>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Search products"
          placeholder="Search by name or SKU…"
          className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white pl-9 pr-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#FF5615] focus:outline-none focus:ring-2 focus:ring-[#FF5615]/25"
        />
      </div>

      <div className={`mt-3 transition-opacity ${isFetching ? "opacity-70" : ""}`} aria-busy={isFetching}>
        {isPending ? (
          <p role="status" className="py-6 text-center text-sm text-[#6B7280]">
            Loading products…
          </p>
        ) : isError ? (
          <div role="alert" className="py-6 text-center text-sm">
            <p className="text-[#DC2626]">Couldn’t load products.</p>
            <button type="button" onClick={() => refetch()} className="mt-1 font-semibold text-[#FF5615] hover:underline">
              Try again
            </button>
          </div>
        ) : data.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#6B7280]">{input.trim() ? "No products match your search." : "No products found."}</p>
        ) : (
          <ul className="divide-y divide-[#F3F4F6]">
            {data.map((p) => {
              const inOrder = lines.find((l) => l.product.id === p.id)?.quantity ?? 0;
              const remaining = p.stock === null ? null : Math.max(0, p.stock - inOrder);
              const canAdd = remaining === null || remaining > 0;
              return (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#111827]">{p.name}</p>
                    <p className="text-xs text-[#6B7280]">
                      {p.sku} · {formatMoney(p.price)}
                    </p>
                  </div>
                  <Availability stock={p.stock} remaining={remaining} />
                  <button
                    type="button"
                    onClick={() => onAdd(p)}
                    disabled={!canAdd}
                    aria-label={`Add ${p.name}`}
                    className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#FF5615] px-3 text-sm font-semibold text-white hover:bg-[#E84A0E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
