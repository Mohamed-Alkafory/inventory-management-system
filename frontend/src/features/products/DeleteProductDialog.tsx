import { useEffect } from "react";
import Modal from "../../components/ui/Modal";
import { ApiError } from "../../lib/http";
import { useDeleteProduct } from "./hooks";
import type { Product } from "./types";

export default function DeleteProductDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const del = useDeleteProduct();
  const { reset } = del;

  // Start clean every time the dialog opens for a product.
  useEffect(() => {
    if (product) reset();
  }, [product, reset]);

  const confirm = async () => {
    if (!product) return;
    try {
      await del.mutateAsync(product.id);
      onClose();
    } catch {
      /* the error is rendered below */
    }
  };

  const message = del.error instanceof ApiError ? del.error.message : del.error ? "Something went wrong. Please try again." : null;

  return (
    <Modal open={product !== null} onClose={onClose} title="Delete product?">
      <p className="text-sm leading-relaxed text-[#6B7280]">
        <span className="font-semibold text-[#111827]">{product?.name}</span> will be deleted. It will disappear
        from the product list (the server keeps its history).
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
          disabled={del.isPending}
          className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615] disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={del.isPending}
          className="rounded-lg bg-[#DC2626] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#B91C1C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626] focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {del.isPending ? "Deleting…" : "Delete"}
        </button>
      </div>
    </Modal>
  );
}
