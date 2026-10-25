import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../auth/useAuth";
import DeleteProductDialog from "../../features/products/DeleteProductDialog";
import ProductFormDialog from "../../features/products/ProductFormDialog";
import { useProducts } from "../../features/products/hooks";
import type { Product } from "../../features/products/types";

const CURRENCY = "USD";
const money = new Intl.NumberFormat(undefined, { style: "currency", currency: CURRENCY });

type DialogState = { mode: "create" } | { mode: "edit"; product: Product } | null;

export default function Products() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data, isPending, isError, refetch } = useProducts();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toDelete, setToDelete] = useState<Product | null>(null);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#111827]">Products</h1>
          <p className="mt-1 text-sm text-[#6B7280]">Manage your product catalog</p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setDialog({ mode: "create" })}
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF5615] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#FF5615]/25 hover:bg-[#E84A0E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615] focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
        {isPending ? (
          <p role="status" className="p-10 text-center text-sm text-[#6B7280]">
            Loading products…
          </p>
        ) : isError ? (
          <div role="alert" className="p-10 text-center text-sm">
            <p className="text-[#DC2626]">Couldn’t load products.</p>
            <button type="button" onClick={() => refetch()} className="mt-2 font-semibold text-[#FF5615] hover:underline">
              Try again
            </button>
          </div>
        ) : data.length === 0 ? (
          <p className="p-10 text-center text-sm text-[#6B7280]">No products yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#F8F8F8] text-xs font-semibold text-[#6B7280]">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Status</th>
                  {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {data.map((p) => (
                  <tr key={p.id} className={p.isActive ? "" : "opacity-60"}>
                    <td className="px-4 py-3 font-semibold text-[#111827]">{p.name}</td>
                    <td className="px-4 py-3 text-[#6B7280]">{p.sku}</td>
                    <td className="px-4 py-3 text-[#6B7280]">{p.category?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-[#6B7280]">{p.supplier?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-[#111827]">{money.format(p.price)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          p.isActive ? "bg-[#DDF5EA] text-[#1F8F6B]" : "bg-[#F3F4F6] text-[#6B7280]"
                        }`}
                      >
                        {p.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setDialog({ mode: "edit", product: p })}
                            aria-label={`Edit ${p.name}`}
                            className="rounded-md p-2 text-[#6B7280] hover:bg-[#FFF1EB] hover:text-[#FF5615] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615]"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {p.isActive && (
                            <button
                              type="button"
                              onClick={() => setToDelete(p)}
                              aria-label={`Deactivate ${p.name}`}
                              className="rounded-md p-2 text-[#6B7280] hover:bg-[#FEF2F2] hover:text-[#DC2626] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProductFormDialog
        open={dialog !== null}
        product={dialog?.mode === "edit" ? dialog.product : undefined}
        onClose={() => setDialog(null)}
      />
      <DeleteProductDialog product={toDelete} onClose={() => setToDelete(null)} />
    </div>
  );
}
