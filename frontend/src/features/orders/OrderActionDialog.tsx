import { useEffect } from "react";
import Modal from "../../components/ui/Modal";
import { ApiError } from "../../lib/http";
import { formatNumber } from "./format";
import { useCancelMyOrder, useCancelOrder, useUpdateOrderStatus } from "./hooks";
import { ACTION_RULES } from "./status";
import type { Id, OrderAction, OrderScope, OrderStatus } from "./types";

export interface ActionTarget {
  action: OrderAction;
  scope: OrderScope;
  order: { id: Id; orderNumber: string; status: OrderStatus; customerName?: string };
}

/**
 * Confirmation step for "Confirm order" / "Cancel order". The scope decides
 * which API is called:
 *   my    → POST /orders/mine/:id/cancel
 *   staff → POST /orders/:id/cancel for PENDING, PATCH /orders/:id/status for
 *           CONFIRMED/staff confirm (mirrors the backend's permissions).
 */
export default function OrderActionDialog({ target, onClose }: { target: ActionTarget | null; onClose: () => void }) {
  const cancelMy = useCancelMyOrder();
  const cancelStaff = useCancelOrder();
  const updateStatus = useUpdateOrderStatus();
  const { reset: resetMy } = cancelMy;
  const { reset: resetStaff } = cancelStaff;
  const { reset: resetStatus } = updateStatus;

  useEffect(() => {
    if (target) {
      // Start clean each time the dialog opens.
      resetMy();
      resetStaff();
      resetStatus();
    }
  }, [target, resetMy, resetStaff, resetStatus]);

  const isCancel = target?.action === "cancel";

  // Which mutation's state the dialog should show.
  const active =
    target?.scope === "my"
      ? cancelMy
      : target?.action === "confirm" || target?.order.status !== "PENDING"
        ? updateStatus
        : cancelStaff;

  const run = async () => {
    if (!target) return;
    try {
      if (target.scope === "my") {
        await cancelMy.mutateAsync(target.order.id);
      } else if (target.action === "confirm") {
        await updateStatus.mutateAsync({ id: target.order.id, status: "CONFIRMED" });
      } else if (target.order.status === "PENDING") {
        await cancelStaff.mutateAsync(target.order.id);
      } else {
        await updateStatus.mutateAsync({ id: target.order.id, status: "CANCELLED" });
      }
      onClose();
    } catch {
      /* the message is shown below; the list has already been refreshed */
    }
  };

  const message = active.error instanceof ApiError ? active.error.message : active.error ? "Something went wrong. Please try again." : null;

  return (
    <Modal open={target !== null} onClose={onClose} title={isCancel ? "Cancel this order?" : "Confirm this order?"}>
      {target && (
        <p className="text-sm leading-relaxed text-[#6B7280]">
          <span className="font-semibold text-[#111827]">
            {formatNumber(target.order.orderNumber)}
            {target.order.customerName ? ` · ${target.order.customerName}` : ""}
          </span>{" "}
          {isCancel
            ? "will be cancelled. This can’t be undone."
            : `will be confirmed and moved to ${ACTION_RULES.confirm.to.toLowerCase()}.`}
        </p>
      )}

      {message && (
        <div role="alert" className="mt-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">
          {message}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={active.isPending}
          className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615] disabled:opacity-60"
        >
          {message ? "Close" : "Go back"}
        </button>
        {!message && (
          <button
            type="button"
            onClick={run}
            disabled={active.isPending}
            className={`rounded-lg px-5 py-2.5 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 ${
              isCancel
                ? "bg-[#DC2626] hover:bg-[#B91C1C] focus-visible:ring-[#DC2626]"
                : "bg-[#FF5615] shadow-md shadow-[#FF5615]/25 hover:bg-[#E84A0E] focus-visible:ring-[#FF5615]"
            }`}
          >
            {active.isPending ? (isCancel ? "Cancelling…" : "Confirming…") : isCancel ? "Cancel order" : "Confirm order"}
          </button>
        )}
      </div>
    </Modal>
  );
}
