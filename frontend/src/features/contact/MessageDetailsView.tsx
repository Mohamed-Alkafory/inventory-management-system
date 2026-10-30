import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, UserCheck, UserX } from "lucide-react";
import Button from "../../components/ui/Button";
import { useAuth } from "../../context/auth/useAuth";
import { can } from "../../lib/permissions";
import { ApiError } from "../../lib/http";
import ContactStatusBadge from "./ContactStatusBadge";
import { SUPPORT_MESSAGES_PATH, formatContactDate } from "./format";
import { useContactMessage, useUpdateContactMessage } from "./hooks";
import { CONTACT_STATUSES, CONTACT_STATUS_LABEL } from "./types";
import type { ContactStatus } from "./types";

const card = "rounded-2xl border border-[#E5E7EB] bg-white";

function BackLink() {
  return (
    <Link to={SUPPORT_MESSAGES_PATH} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6B7280] hover:text-[#FF5615]">
      <ArrowLeft className="h-4 w-4" />
      Back to messages
    </Link>
  );
}

/**
 * Private contact-message detail. Assignee and internal note are only ever
 * rendered inside this support area (ADMIN/SUPPORT routes).
 */
export default function MessageDetailsView({ id }: { id: string }) {
  const { user, role } = useAuth();
  const { data: message, isPending, isError, error, refetch } = useContactMessage(id);
  const update = useUpdateContactMessage();

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <BackLink />
        <p role="status" className="py-10 text-center text-sm text-[#6B7280]">
          Loading message…
        </p>
      </div>
    );
  }

  if (isError || !message) {
    const forbidden = error instanceof ApiError && error.status === 403;
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <div className="mx-auto w-full max-w-4xl">
        <BackLink />
        <div role="alert" className="py-10 text-center text-sm">
          <p className={missing || forbidden ? "font-semibold text-[#111827]" : "text-[#DC2626]"}>
            {forbidden ? "You don’t have access to this message." : missing ? "Message not found" : "Couldn’t load this message."}
          </p>
          {missing && <p className="mt-1 text-[#6B7280]">It may have been removed, or the link is wrong.</p>}
          {!forbidden && !missing && (
            <button type="button" onClick={() => refetch()} className="mt-2 font-semibold text-[#FF5615] hover:underline">
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  const canManage = can(role, "contact.manage");
  const assignedToMe = !!user?.id && message.assignedToId === user.id;
  const updateError = update.error;
  const updateMessage =
    updateError instanceof ApiError
      ? updateError.status === 403
        ? "You don’t have permission to triage this message."
        : updateError.status === 404
          ? "The message or assignee no longer exists."
          : updateError.serverMessage ?? updateError.message
      : updateError
        ? "Couldn’t save your changes."
        : null;

  return (
    <div className="mx-auto w-full max-w-4xl text-ink">
      <BackLink />

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#111827]">{message.subject || "(no subject)"}</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            From <span className="font-semibold text-[#374151]">{message.name || message.email}</span> · {formatContactDate(message.createdAt)}
          </p>
        </div>
        <ContactStatusBadge status={message.status} />
      </div>

      {updateMessage && (
        <p role="alert" className="mt-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">
          {updateMessage}
        </p>
      )}

      <section aria-labelledby="message-h" className={`${card} mt-5 p-5`}>
        <h2 id="message-h" className="text-sm font-bold text-[#111827]">
          Message
        </h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">Sender</dt>
            <dd className="mt-0.5 text-[#111827]">{message.name || "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">Email</dt>
            <dd className="mt-0.5">
              <a href={`mailto:${message.email}`} className="text-[#FF5615] hover:underline">
                {message.email || "—"}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">Received</dt>
            <dd className="mt-0.5 text-[#111827]">{formatContactDate(message.createdAt)}</dd>
          </div>
        </dl>
        <p className="mt-4 whitespace-pre-line border-t border-[#F3F4F6] pt-4 text-sm leading-relaxed text-[#374151]">
          {message.message || "No message body."}
        </p>
      </section>

      <section aria-labelledby="triage-h" className={`${card} mt-4 p-5`}>
        <h2 id="triage-h" className="text-sm font-bold text-[#111827]">
          Triage
        </h2>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-[#6B7280]">
            Status
            <select
              value={message.status}
              disabled={!canManage || update.isPending}
              onChange={(e) => update.mutate({ id: message.id, patch: { status: e.target.value as ContactStatus } })}
              aria-label="Change status"
              className="mt-1 block h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm font-normal text-[#111827] focus:border-[#FF5615] focus:outline-none focus:ring-2 focus:ring-[#FF5615]/25 disabled:opacity-60"
            >
              {CONTACT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CONTACT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>

          <div className="flex h-10 items-center gap-2 text-sm">
            <span className="text-[#6B7280]">Assignee:</span>
            <span className="font-semibold text-[#111827]">{message.assignedTo?.name || "Unassigned"}</span>
            {canManage && (
              <Button
                type="button"
                size="sm"
                variant={assignedToMe ? "ghost" : "secondary"}
                loading={update.isPending}
                leftIcon={assignedToMe ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
                onClick={() =>
                  update.mutate({ id: message.id, patch: { assignedToId: assignedToMe ? null : user?.id ?? null } })
                }
              >
                {assignedToMe ? "Unassign" : "Assign to me"}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 border-t border-[#F3F4F6] pt-4">
          <InternalNoteEditor
            key={message.id}
            initialNote={message.internalNote ?? ""}
            disabled={!canManage || update.isPending}
            canManage={canManage}
            onSave={(internalNote) => update.mutate({ id: message.id, patch: { internalNote } })}
          />
        </div>
      </section>
    </div>
  );
}

/** The draft note is local so typing does not touch the query cache. */
function InternalNoteEditor({
  initialNote,
  disabled,
  canManage,
  onSave,
}: {
  initialNote: string;
  disabled: boolean;
  canManage: boolean;
  onSave: (internalNote: string | null) => void;
}) {
  const [note, setNote] = useState(initialNote);

  return (
    <>
      <label htmlFor="internal-note" className="text-xs font-semibold text-[#6B7280]">
        Internal note <span className="font-normal">(support and admin only)</span>
      </label>
      <textarea
        id="internal-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={5000}
        rows={4}
        disabled={disabled}
        className="mt-1 w-full resize-y rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] focus:border-[#FF5615] focus:outline-none focus:ring-2 focus:ring-[#FF5615]/25 disabled:opacity-60"
        placeholder="Only visible inside the support and admin screens"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-[#6B7280]">{note.length}/5000</p>
        {canManage && (
          <Button type="button" size="sm" disabled={disabled} onClick={() => onSave(note.trim() || null)}>
            Save note
          </Button>
        )}
      </div>
    </>
  );
}
