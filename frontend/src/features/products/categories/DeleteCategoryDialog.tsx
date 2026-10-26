import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "../../../components/ui/Modal";
import { ApiError } from "../../../lib/http";
import { useDeleteCategory } from "./hooks";
import type { Category } from "./types";

export default function DeleteCategoryDialog({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const del = useDeleteCategory();
  const { reset } = del;

  useEffect(() => {
    if (category) reset(); // start clean each time the dialog opens
  }, [category, reset]);

  const confirm = async () => {
    if (!category) return;
    try {
      await del.mutateAsync(category.id);
      onClose();
    } catch {
      /* explained below */
    }
  };

  const err = del.error instanceof ApiError ? del.error : null;
  const blocked = err?.status === 409; // category still has products

  // Prefer the server's own explanation; fall back to a clear default.
  const blockedText =
    err?.serverMessage ??
    `“${category?.name}” still has products assigned to it. Move or deactivate those products first, then try again.`;

  return (
    <Modal open={category !== null} onClose={onClose} title={blocked ? "Can’t delete this category" : "Delete category?"}>
      {blocked ? (
        <div role="alert" className="flex gap-3 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3 text-sm text-[#92400E]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="leading-relaxed">{blockedText}</p>
        </div>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-[#6B7280]">
            <span className="font-semibold text-[#111827]">{category?.name}</span> will be permanently deleted. This
            can’t be undone.
          </p>
          {del.error && (
            <div role="alert" className="mt-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">
              {err ? err.message : "Something went wrong. Please try again."}
            </div>
          )}
        </>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={del.isPending}
          className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615] disabled:opacity-60"
        >
          {blocked ? "Close" : "Cancel"}
        </button>
        {!blocked && (
          <button
            type="button"
            onClick={confirm}
            disabled={del.isPending}
            className="rounded-lg bg-[#DC2626] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#B91C1C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626] focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {del.isPending ? "Deleting…" : "Delete"}
          </button>
        )}
      </div>
    </Modal>
  );
}
