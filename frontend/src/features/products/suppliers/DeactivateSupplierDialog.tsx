import { useEffect } from "react";
import Modal from "../../../components/ui/Modal";
import { ApiError } from "../../../lib/http";
import { useDeactivateSupplier } from "./hooks";
import type { Supplier } from "./types";

export default function DeactivateSupplierDialog({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const mutation = useDeactivateSupplier();
  const { reset } = mutation;

  useEffect(() => {
    if (supplier) reset(); // start clean each time the dialog opens
  }, [supplier, reset]);

  const confirm = async () => {
    if (!supplier) return;
    try {
      await mutation.mutateAsync(supplier.id);
      onClose();
    } catch {
      /* shown below */
    }
  };

  const message = mutation.error instanceof ApiError ? mutation.error.message : mutation.error ? "Something went wrong. Please try again." : null;

  return (
    <Modal open={supplier !== null} onClose={onClose} title="Deactivate supplier?">
      <p className="text-sm leading-relaxed text-[#6B7280]">
        <span className="font-semibold text-[#111827]">{supplier?.name}</span> will be marked as inactive. Its records
        and history are kept.
      </p>

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
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={mutation.isPending}
          className="rounded-lg bg-[#DC2626] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#B91C1C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626] focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {mutation.isPending ? "Deactivating…" : "Deactivate"}
        </button>
      </div>
    </Modal>
  );
}
