import { useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { productsApi } from "../../../api/productsApi";
import { Button, EmptyState, ErrorState, Select, Skeleton, StatusBadge } from "../../../components/ui";
import { Card, CardBody } from "../../../components/ui/Card";
import { buttonClass } from "../../../components/ui/buttonClass";
import { cn } from "../../../lib/cn";
import type { InventoryProduct, StockStatus } from "../../../types/inventory";

const PAGE_SIZE = 10;
type Filter = StockStatus;

const LABELS: Record<Filter, string> = {
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
  in_stock: "In stock",
};

/** How full the shelf is compared with 2× the reorder level (just a visual cue). */
function Level({ p }: { p: InventoryProduct }) {
  const target = Math.max(p.reorderLevel * 2, 1);
  const pct = Math.min(100, Math.round((p.stock / target) * 100));
  const color = p.status === "out_of_stock" ? "bg-danger-600" : p.status === "low_stock" ? "bg-warning-600" : "bg-success-600";
  return (
    <div className="w-32">
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted tabular-nums">
        {p.stock} / reorder at {p.reorderLevel}
      </p>
    </div>
  );
}

/** Read-only stock monitor: which products need reordering. Editing happens in Products. */
export default function Inventory() {
  const [status, setStatus] = useState<Filter>("low_stock");
  const [page, setPage] = useState(1);

  const { data, isPending, isError, refetch, isPlaceholderData } = useQuery({
    queryKey: ["products", "admin-inventory", status, page],
    queryFn: () =>
      productsApi.list({ search: "", category: "", status, sortBy: "stock", sortDir: "asc", page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory</h1>
          <p className="mt-1 text-sm text-muted">Track stock levels and spot products that need reordering.</p>
        </div>
        <Select
          aria-label="Stock level"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as Filter);
            setPage(1);
          }}
          wrapperClassName="sm:w-48"
        >
          {(Object.keys(LABELS) as Filter[]).map((k) => (
            <option key={k} value={k}>
              {LABELS[k]}
            </option>
          ))}
        </Select>
      </div>

      <Card className={cn("mt-6 overflow-hidden", isPlaceholderData && "opacity-60")}>
        {isPending ? (
          <CardBody className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardBody>
        ) : isError ? (
          <ErrorState title="Couldn't load inventory" onRetry={() => void refetch()} />
        ) : data.items.length === 0 ? (
          <EmptyState
            title={`No ${LABELS[status].toLowerCase()} products`}
            description="Nothing to show for this stock level right now."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-surface-alt text-xs font-semibold text-muted">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Stock level</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{p.name}</p>
                      <p className="font-mono text-xs text-muted">{p.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">{p.category || "—"}</td>
                    <td className="px-4 py-3">
                      <Level p={p} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/admin/products?q=${encodeURIComponent(p.sku)}`}
                        className={buttonClass("secondary", "sm")}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && total > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted">
            <span>
              {total} {total === 1 ? "product" : "products"} · page {Math.min(page, pages)} of {pages}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
