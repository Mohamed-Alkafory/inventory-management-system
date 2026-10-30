import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { EmptyState, StatusBadge } from "../../components/ui";
import { useDashboardLowStock } from "./hooks";
import WidgetCard from "./WidgetCard";

export default function LowStockTable() {
  const query = useDashboardLowStock();

  return (
    <WidgetCard
      title="Low stock"
      description={
        query.data
          ? `${query.data.total} product${query.data.total === 1 ? "" : "s"} at or below the reorder level`
          : "Products at or below their reorder level"
      }
      query={query}
      action={
        <Link
          to="/admin/inventory"
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline"
        >
          View inventory <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      }
    >
      {query.data && query.data.items.length === 0 ? (
        <EmptyState title="All stocked up" description="No product is at or below its reorder level." className="py-6" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-surface-alt text-xs font-semibold text-muted">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Stock</th>
                <th className="px-3 py-2">Reorder at</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {query.data?.items.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-ink">{p.name}</p>
                    <p className="text-xs text-muted">{p.category || "-"}</p>
                  </td>
                  <td className="px-3 py-3 text-muted">{p.sku}</td>
                  <td
                    className={`px-3 py-3 font-semibold tabular-nums ${
                      p.stock === 0 ? "text-danger-600" : "text-warning-600"
                    }`}
                  >
                    {p.stock}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-muted">{p.reorderLevel}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WidgetCard>
  );
}
