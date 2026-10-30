import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, PackagePlus, ShoppingCart, X } from "lucide-react";
import Button from "../../components/ui/Button";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import PoStatusBadge from "./PoStatusBadge";
import { PO_STATUS_LABEL, allowedActions, canReceive } from "./status";
import ReceiveDialog from "./ReceiveDialog";
import ErrorState from "../../components/ui/ErrorState";
import { useAuth } from "../../context/auth/useAuth";
import { can } from "../../lib/permissions";
import { PO_PATH, formatDate, formatDateTime, formatMoney } from "./format";
import { usePoTransition, usePurchaseOrder } from "./hooks";

const money = formatMoney;

type ConfirmAction = "order" | "cancel";

/**
 * Purchase-order detail (ADMIN): header card + item lines + lifecycle
 * actions — place order (DRAFT), cancel (DRAFT|ORDERED) and the receive
 * dialog (ORDERED|PARTIALLY_RECEIVED). Receiving more than remaining is
 * blocked in the dialog and again server-side (409).
 */
export default function PurchaseOrderDetailsView({ id, basePath = PO_PATH }: { id: string; basePath?: string }) {
  const { role } = useAuth();
  const { data: po, isPending, isError, refetch } = usePurchaseOrder(id);

  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const transition = usePoTransition();

  if (isPending) {
    return (
      <p role="status" className="p-10 text-center text-sm text-[#6B7280]">
        Loading purchase order…
      </p>
    );
  }

  if (isError || !po) {
    return (
      <ErrorState
        title="Couldn’t load this purchase order"
        message="It may have been cancelled by another admin, or the link is stale."
        onRetry={() => refetch()}
      />
    );
  }

  const allowed = can(role, "po.updateStatus") ? allowedActions(po.status) : [];
  const mayReceive = can(role, "po.receive") && canReceive(po.status);
  const remainingTotal = po.lines.reduce((sum, l) => sum + Math.max(0, l.quantityOrdered - l.quantityReceived), 0);

  const details: { label: string; value: string }[] = [
    { label: "Supplier", value: po.supplierName || po.supplierId },
    { label: "Created", value: formatDateTime(po.createdAt) },
    { label: "Expected", value: po.status === "received" ? "—" : formatDate(po.expectedAt) },
    { label: "Received", value: po.receivedAt ? formatDateTime(po.receivedAt) : "—" },
  ];

  const runTransition = async () => {
    if (!confirm) return;
    setActionError(null);
    try {
      await transition.mutateAsync({ id: po.id, action: confirm });
      setConfirm(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const confirmCopy: Record<ConfirmAction, { title: string; description: string; confirmLabel: string }> = {
    order: {
      title: "Place this order?",
      description: "The PO will be marked as ordered and sent to the supplier. You can still cancel while it's awaiting delivery.",
      confirmLabel: "Place order",
    },
    cancel: {
      title: "Cancel this purchase order?",
      description: "Already received stock stays in inventory, but undelivered lines are closed for good. This can't be undone.",
      confirmLabel: "Yes, cancel it",
    },
  };

  return (
    <div>
      <Link to={basePath} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#FF5615] hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All purchase orders
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold text-[#111827]">#{po.number}</h1>
            <PoStatusBadge status={po.status} />
          </div>
          <p className="mt-1 text-sm text-[#6B7280]">
            {po.supplierName || "Supplier"} — total {money(po.total)} ordered on {formatDate(po.createdAt)}
            {po.notes && <> · notes below</>}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {allowed.includes("order") && (
            <Button size="sm" leftIcon={<ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => setConfirm("order")}>
              Place order
            </Button>
          )}
          {mayReceive && (
            <Button size="sm" leftIcon={<PackagePlus className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => setReceiveOpen(true)}>
              Receive stock{remainingTotal > 0 ? ` (${remainingTotal} left)` : ""}
            </Button>
          )}
          {allowed.includes("cancel") && (
            <Button size="sm" variant="secondary" leftIcon={<X className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => setConfirm("cancel")}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {po.notes && (
        <div className="mt-3 rounded-xl border border-[#E5E7EB] bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Notes</p>
          <p className="mt-0.5 text-sm whitespace-pre-wrap text-[#374151]">{po.notes}</p>
        </div>
      )}

      {actionError && (
        <div role="alert" className="mt-3 rounded-control border border-danger-600/20 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {actionError}
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 lg:col-span-2">
          <h2 className="text-sm font-bold text-[#111827]">Items</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[13px]">
              <thead className="text-[11px] font-semibold text-[#6B7280]">
                <tr className="border-b border-[#F3F4F6]">
                  <th className="py-1.5 pr-3">Product</th>
                  <th className="w-24 py-1.5 pr-3 text-right">Ordered</th>
                  <th className="w-24 py-1.5 pr-3 text-right">Received</th>
                  <th className="w-24 py-1.5 pr-3 text-right">Unit cost</th>
                  <th className="w-28 py-1.5 text-right">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {po.lines.map((l) => (
                  <tr key={l.productId}>
                    <td className="py-2 pr-3">
                      <p className="font-medium text-[#111827]">{l.name || "(product)"}</p>
                      <p className="text-[11px] text-[#6B7280]">{l.sku || l.productId}</p>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{l.quantityOrdered}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[#6B7280]">
                      {l.quantityReceived}
                      {l.quantityReceived > 0 && l.quantityReceived < l.quantityOrdered && (
                        <span className="ms-1 text-[11px] font-semibold text-[#F59E0B]">partial</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[#374151]">{money(l.unitCost)}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{money(l.unitCost * l.quantityOrdered)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#E5E7EB]">
                  <td colSpan={4} className="py-2 pr-3 text-right text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
                    Total
                  </td>
                  <td className="py-2 text-right font-extrabold tabular-nums text-[#111827]">{money(po.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
          <h2 className="text-sm font-bold text-[#111827]">Details</h2>
          <dl className="mt-2 space-y-2.5 text-[13px]">
            {details.map((d) => (
              <div key={d.label}>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{d.label}</dt>
                <dd className="mt-0.5 text-[#374151]">{d.value}</dd>
              </div>
            ))}
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Status</dt>
              <dd className="mt-0.5 text-[#374151]">{PO_STATUS_LABEL[po.status]}</dd>
            </div>
          </dl>
        </div>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm ? confirmCopy[confirm].title : ""}
        description={confirm ? confirmCopy[confirm].description : undefined}
        confirmLabel={confirm ? confirmCopy[confirm].confirmLabel : "Confirm"}
        tone={confirm === "cancel" ? "danger" : "primary"}
        loading={transition.isPending}
        onConfirm={() => void runTransition()}
        onCancel={() => setConfirm(null)}
      />
      {receiveOpen && <ReceiveDialog poId={po.id} onClose={() => setReceiveOpen(false)} />}
    </div>
  );
}
