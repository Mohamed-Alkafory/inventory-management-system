import { useEffect } from "react";
import Modal from "../../components/ui/Modal";
import { ApiError } from "../../lib/http";
import { formatNumber } from "./format";
import { useOrderAction } from "./hooks";
import { ACTION_RULES, STATUS_LABEL } from "./status";
import type { Id, OrderAction } from "./types";

export interface ActionTarget {
  action: OrderAction;
  order: { id: Id; number: string; customerName: string };
}

/** Confirmation step for "Confirm order" / "Cancel order". */
export default function OrderActionDialog({ target, onClose }: { target: ActionTarget | null; onClose: () => void }) {
  const mutation = useOrderAction();
  const { reset } = mutation;

  useEffect(() => {
    if (target) reset(); // start clean each time the dialog opens
  }, [target, reset]);

  const isCancel = target?.action === "cancel";

  const run = async () => {
    if (!target) return;
    try {
      await mutation.mutateAsync({ id: target.order.id, action: target.action });
      onClose();
    } catch {
      /* the message is shown below; the list has already been refreshed */
    }
  };

  const message = mutation.error instanceof ApiError ? mutation.error.message : mutation.error ? "Something went wrong. Please try again." : null;

  return (
    <Modal open={target !== null} onClose={onClose} title={isCancel ? "Cancel this order?" : "Confirm this order?"}>
      {target && (
        <p className="text-sm leading-relaxed text-[#6B7280]">
          <span className="font-semibold text-[#111827]">
            {formatNumber(target.order.number)}
            {target.order.customerName ? ` · ${target.order.customerName}` : ""}
          </span>{" "}
          {isCancel
            ? "will be cancelled. This can’t be undone."
            : `will be confirmed and moved to ${STATUS_LABEL[ACTION_RULES.confirm.to]}.`}
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
          disabled={mutation.isPending}
          className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615] disabled:opacity-60"
        >
          {message ? "Close" : "Go back"}
        </button>
        {!message && (
          <button
            type="button"
            onClick={run}
            disabled={mutation.isPending}
            className={`rounded-lg px-5 py-2.5 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 ${
              isCancel
                ? "bg-[#DC2626] hover:bg-[#B91C1C] focus-visible:ring-[#DC2626]"
                : "bg-[#FF5615] shadow-md shadow-[#FF5615]/25 hover:bg-[#E84A0E] focus-visible:ring-[#FF5615]"
            }`}
          >
            {mutation.isPending ? (isCancel ? "Cancelling…" : "Confirming…") : isCancel ? "Cancel order" : "Confirm order"}
          </button>
        )}
      </div>
    </Modal>
  );
}
