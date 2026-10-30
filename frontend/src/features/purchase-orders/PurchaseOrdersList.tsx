import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Ban, Eye, PackagePlus, PackageSearch, Plus, ShoppingCart, Truck } from "lucide-react";
import Pagination from "../../components/ui/Pagination";
import RowActionsMenu from "../../components/ui/RowActionsMenu";
import type { MenuAction } from "../../components/ui/RowActionsMenu";
import { useAuth } from "../../context/auth/useAuth";
import { can } from "../../lib/permissions";
import CreatePoDialog, { type ReorderPrefill } from "./CreatePoDialog";
import ReceiveDialog from "./ReceiveDialog";
import { PO_PATH, formatDate, formatMoney, poPath } from "./format";
import { usePoTransition, usePurchaseOrders } from "./hooks";
import { PO_STATUSES, PO_STATUS_LABEL, allowedActions, canReceive } from "./status";
import PoStatusBadge from "./PoStatusBadge";
import type { PoListParams, PurchaseOrder } from "./types";
import { useSupplierPage } from "../products/suppliers/hooks";

const PAGE_SIZE = 10;

const control =
  "h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:border-[#FF5615] focus:outline-none focus:ring-2 focus:ring-[#FF5615]/25";

/**
 * Purchase-orders list (ADMIN): status + supplier filters, pagination and
 * per-row lifecycle actions. A low-stock "Reorder" in the inventory
 * navigates here with { reorderProduct } in router state, which opens the
 * create dialog pre-filled — so restocking is two clicks.
 */
export default function PurchaseOrdersList({ basePath = PO_PATH }: { basePath?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();
  const canCreate = can(role, "po.create");
  const canUpdateStatus = can(role, "po.updateStatus");
  const canReceivePo = can(role, "po.receive");

  const [status, setStatus] = useState<PoListParams["status"]>("");
  const [supplierId, setSupplierId] = useState("");
  const [page, setPage] = useState(1);
  // Mount-time init: arriving from the inventory "Reorder" action (router
  // state) opens the composer pre-filled; anything later opens it empty.
  const [create, setCreate] = useState<{ open: boolean; prefill: ReorderPrefill | null }>(() => {
    const prefill = (location.state as { reorderProduct?: ReorderPrefill } | null)?.reorderProduct ?? null;
    return { open: prefill !== null, prefill };
  });
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const suppliers = useSupplierPage({ search: "", page: 1, pageSize: 100 });
  const transition = usePoTransition();

  const params: PoListParams = { status, supplierId, page, pageSize: PAGE_SIZE };
  const { data, isPending, isError, isFetching, refetch } = usePurchaseOrders(params);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const first = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const last = Math.min(currentPage * PAGE_SIZE, total);
  const filtered = !!(status || supplierId);
  const supplierNames = new Map((suppliers.data?.items ?? []).map((s) => [String(s.id), s.name]));

  const actionsFor = (po: PurchaseOrder): MenuAction[] => {
    const allowed = canUpdateStatus ? allowedActions(po.status) : [];
    const detail = { label: "View details", icon: Eye, onSelect: () => navigate(poPath(po.id, basePath)) };
    return [
      detail,
      ...(allowed.includes("order")
        ? [{ label: "Place order", icon: ShoppingCart, onSelect: () => void runTransition(po, "order") }]
        : []),
      ...(canReceivePo && canReceive(po.status)
        ? [{ label: "Receive stock", icon: PackagePlus, onSelect: () => setReceivingId(po.id) }]
        : []),
      ...(allowed.includes("cancel")
        ? [{ label: "Cancel order", icon: Ban, danger: true, onSelect: () => void runTransition(po, "cancel") }]
        : []),
    ];
  };

  const runTransition = async (po: PurchaseOrder, action: "order" | "cancel") => {
    setActionError(null);
    try {
      await transition.mutateAsync({ id: po.id, action });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as PoListParams["status"]);
            setPage(1);
          }}
          aria-label="Filter by status"
          className={control}
        >
          <option value="">All statuses</option>
          {PO_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PO_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={supplierId}
          onChange={(e) => {
            setSupplierId(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by supplier"
          className={`${control} max-w-56`}
        >
          <option value="">All suppliers</option>
          {suppliers.data?.items.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.name}
            </option>
          ))}
        </select>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setStatus("");
              setSupplierId("");
              setPage(1);
            }}
            className="h-10 text-sm font-semibold text-[#FF5615] hover:underline"
          >
            Clear filters
          </button>
        )}
        {canCreate && (
          <button
            type="button"
            onClick={() => setCreate({ open: true, prefill: null })}
            className="ms-auto inline-flex h-10 items-center gap-2 rounded-lg bg-[#FF5615] px-4 text-sm font-semibold text-white transition hover:bg-[#E74B0F]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New purchase order
          </button>
        )}
      </div>

      {actionError && (
        <div role="alert" className="mt-3 rounded-control border border-danger-600/20 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {actionError}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
        {isPending ? (
          <p role="status" className="p-10 text-center text-sm text-[#6B7280]">
            Loading purchase orders…
          </p>
        ) : isError ? (
          <div role="alert" className="p-10 text-center text-sm">
            <p className="text-[#DC2626]">Couldn’t load purchase orders.</p>
            <button type="button" onClick={() => refetch()} className="mt-2 font-semibold text-[#FF5615] hover:underline">
              Try again
            </button>
          </div>
        ) : data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <PackageSearch className="h-10 w-10 text-[#D1D5DB]" aria-hidden="true" />
            <p className="text-sm font-medium text-[#374151]">{filtered ? "No purchase orders match these filters." : "No purchase orders yet."}</p>
            {!filtered && canCreate && <p className="text-sm text-[#6B7280]">Create one to restock products from a supplier.</p>}
          </div>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${isFetching ? "opacity-60" : ""}`} aria-busy={isFetching}>
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#F8F8F8] text-xs font-semibold text-[#6B7280]">
                <tr>
                  <th className="px-4 py-3">PO number</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Expected</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {data.items.map((po) => (
                  <tr key={po.id}>
                    <td className="px-4 py-3">
                      <Link to={poPath(po.id, basePath)} className="font-semibold text-[#111827] hover:text-[#FF5615] hover:underline">
                        #{po.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#374151]">
                      {po.supplierName || supplierNames.get(po.supplierId) || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#6B7280]">{formatDate(po.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#6B7280]">{po.status === "received" ? formatDate(po.receivedAt) : formatDate(po.expectedAt)}</td>
                    <td className="px-4 py-3 font-semibold text-[#111827]">{formatMoney(po.total)}</td>
                    <td className="px-4 py-3">
                      <PoStatusBadge status={po.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <RowActionsMenu label={`Actions for #${po.number}`} actions={actionsFor(po)} />
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
              Showing {first}–{last} of {total} {total === 1 ? "purchase order" : "purchase orders"}
            </p>
            {totalPages > 1 && <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />}
          </div>
        )}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-[#9CA3AF]">
        <Truck className="h-3.5 w-3.5" aria-hidden="true" />
        Receiving stock updates product quantities and writes purchase movements automatically.
      </p>

      {canCreate && create.open && (
        <CreatePoDialog
          prefill={create.prefill}
          onClose={() => {
            setCreate({ open: false, prefill: null });
            // A reorder prefill travels in router state — clear it once the
            // composer closes so a re-navigation doesn't re-open it.
            if (location.state) navigate(location.pathname + location.search, { replace: true, state: null });
          }}
        />
      )}
      {receivingId && <ReceiveDialog poId={receivingId} onClose={() => setReceivingId(null)} />}
    </div>
  );
}
