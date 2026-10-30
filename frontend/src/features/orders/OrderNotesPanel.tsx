import { useState } from "react";
import { MessageSquare } from "lucide-react";
import Button from "../../components/ui/Button";
import { ApiError } from "../../lib/http";
import { formatDateTime } from "./format";
import { useAddOrderNote, useOrderNotes } from "./hooks";
import type { Id } from "./types";

const MAX_NOTE = 2000;

/**
 * Internal note thread for one order (GET/POST /orders/:id/notes).
 *
 * Only mounted inside the staff/support order details — notes are private and
 * never appear in any customer-facing screen. The list is oldest first, as the
 * backend returns it; a newly added note is appended to the cache immediately
 * and the thread is revalidated in the background.
 */
export default function OrderNotesPanel({
  orderId,
  canWrite,
}: {
  orderId: Id;
  canWrite: boolean;
}) {
  const { data: notes, isPending, isError, error, refetch } = useOrderNotes(orderId);
  const addNote = useAddOrderNote(orderId);
  const [draft, setDraft] = useState("");

  const trimmed = draft.trim();
  const tooLong = draft.length > MAX_NOTE;
  const canSubmit = canWrite && trimmed.length > 0 && !tooLong && !addNote.isPending;

  const loadForbidden = error instanceof ApiError && error.status === 403;
  const loadMissing = error instanceof ApiError && error.status === 404;
  const addError = addNote.error;
  const addMessage =
    addError instanceof ApiError
      ? addError.status === 403
        ? "You don’t have permission to add notes to this order."
        : addError.status === 404
          ? "This order no longer exists."
          : addError.serverMessage ?? addError.message
      : addError
        ? "Couldn’t add this note."
        : null;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      await addNote.mutateAsync(trimmed);
      setDraft("");
    } catch {
      /* the error is rendered above; the draft is kept so it can be retried */
    }
  };

  return (
    <section aria-labelledby="notes-h" className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-[#6B7280]" aria-hidden="true" />
        <h2 id="notes-h" className="text-sm font-bold text-[#111827]">
          Internal notes
        </h2>
      </div>
      <p className="mt-1 text-xs text-[#6B7280]">Only staff, support and admins can see these notes.</p>

      {isPending ? (
        <p role="status" className="mt-4 text-sm text-[#6B7280]">
          Loading notes…
        </p>
      ) : isError ? (
        <div role="alert" className="mt-4 text-sm">
          <p className={loadForbidden || loadMissing ? "font-semibold text-[#111827]" : "text-[#DC2626]"}>
            {loadForbidden
              ? "You don’t have access to this order’s notes."
              : loadMissing
                ? "This order no longer exists."
                : "Couldn’t load notes."}
          </p>
          {!loadForbidden && !loadMissing && (
            <button type="button" onClick={() => refetch()} className="mt-1 font-semibold text-[#FF5615] hover:underline">
              Try again
            </button>
          )}
        </div>
      ) : (notes?.length ?? 0) === 0 ? (
        <p className="mt-4 text-sm text-[#6B7280]">No notes yet.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {(notes ?? []).map((note) => (
            <li key={note.id} className="rounded-lg border border-[#F3F4F6] bg-[#FAFAFA] px-3 py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[13px] font-semibold text-[#111827]">{note.author?.name || "Support team"}</p>
                <time dateTime={note.createdAt || undefined} className="text-xs text-[#6B7280]">
                  {formatDateTime(note.createdAt)}
                </time>
              </div>
              <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-[#374151]">{note.note}</p>
            </li>
          ))}
        </ol>
      )}

      {canWrite && (
        <div className="mt-5 border-t border-[#F3F4F6] pt-4">
          <label htmlFor="order-note" className="text-xs font-semibold text-[#6B7280]">
            Add a note
          </label>
          <textarea
            id="order-note"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_NOTE}
            rows={3}
            disabled={addNote.isPending}
            placeholder="Internal note (never shown to the customer)"
            className="mt-1 w-full resize-y rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] focus:border-[#FF5615] focus:outline-none focus:ring-2 focus:ring-[#FF5615]/25 disabled:opacity-60"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className={`text-xs ${tooLong ? "font-semibold text-[#DC2626]" : "text-[#6B7280]"}`}>
              {draft.length}/{MAX_NOTE}
            </p>
            <Button type="button" size="sm" onClick={submit} disabled={!canSubmit} loading={addNote.isPending}>
              Add note
            </Button>
          </div>
          {addMessage && (
            <p role="alert" className="mt-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">
              {addMessage}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
