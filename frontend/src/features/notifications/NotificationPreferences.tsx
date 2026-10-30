import { useState } from "react";
import { BellRing } from "lucide-react";
import { useAuth } from "../../context/auth/useAuth";
import { errorMessage } from "../../lib/errorMessage";
import { useNotificationPreferences, useUpdateNotificationPreferences } from "./hooks";
import { NOTIFICATION_TYPE_LABEL, ROLE_NOTIFICATION_TYPES } from "./types";
import type { NotificationPreferenceInput, NotificationType } from "./types";

const DESCRIPTION: Partial<Record<NotificationType, string>> = {
  LOW_STOCK: "When a product reaches its minimum stock level.",
  ORDER_CREATED: "When a new order is placed.",
  ORDER_CONFIRMED: "When one of your orders is confirmed.",
  ORDER_CANCELLED: "When an order is cancelled.",
  PURCHASE_ORDER_RECEIVED: "When a purchase order is received into stock.",
  CONTACT_MESSAGE_RECEIVED: "When a new contact message arrives.",
  SYSTEM: "Account and system announcements.",
};

export default function NotificationPreferences() {
  const { role } = useAuth();
  const types = role ? ROLE_NOTIFICATION_TYPES[role] : [];
  const { data, isPending, isError, error, refetch } = useNotificationPreferences(types.length > 0);
  const save = useUpdateNotificationPreferences();

  const [draft, setDraft] = useState<Partial<Record<NotificationType, boolean>>>({});
  const [signature, setSignature] = useState("");

  const nextSignature = data ? `${role}:${data.map((p) => `${p.type}:${p.enabled}`).join("|")}` : "";
  if (data && nextSignature !== signature) {
    setSignature(nextSignature);
    setDraft(
      Object.fromEntries(types.map((type) => [type, data.find((p) => p.type === type)?.enabled ?? true])),
    );
  }

  if (types.length === 0) {
    return (
      <section aria-labelledby="notification-preferences-heading" className="mt-10">
        <h2 id="notification-preferences-heading" className="text-lg font-bold text-[#111827]">
          Notification settings
        </h2>
        <p className="mt-1 text-sm text-[#6B7280]">No notification types apply to your role.</p>
      </section>
    );
  }

  const payload: NotificationPreferenceInput[] = types.map((type) => ({
    type,
    enabled: draft[type] ?? true,
  }));
  const dirty = data
    ? types.some((type) => (draft[type] ?? true) !== (data.find((p) => p.type === type)?.enabled ?? true))
    : false;

  return (
    <section aria-labelledby="notification-preferences-heading" className="mt-10">
      <div className="flex items-center gap-2">
        <BellRing className="size-5 text-[#FF5A26]" aria-hidden="true" />
        <h2 id="notification-preferences-heading" className="text-lg font-bold text-[#111827]">
          Notification settings
        </h2>
      </div>
      <p className="mt-1 text-sm text-[#6B7280]">Choose which updates you want to receive.</p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
        {isPending ? (
          <p role="status" className="p-6 text-sm text-[#6B7280]">
            Loading preferences…
          </p>
        ) : isError ? (
          <div role="alert" className="p-6 text-sm">
            <p className="text-[#DC2626]">{errorMessage(error, "Couldn't load notification preferences.")}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-2 font-semibold text-[#FF5A26] hover:underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-[#F3F4F6]">
            {types.map((type) => {
              const enabled = draft[type] ?? true;
              return (
                <li key={type} className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">{NOTIFICATION_TYPE_LABEL[type]}</p>
                    <p className="text-xs text-[#6B7280]">{DESCRIPTION[type]}</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      role="switch"
                      aria-label={NOTIFICATION_TYPE_LABEL[type]}
                      checked={enabled}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, [type]: event.target.checked }))
                      }
                      className="peer sr-only"
                    />
                    <span className="h-6 w-11 rounded-full bg-[#CBD5E1] transition peer-checked:bg-[#FF5A26] peer-focus-visible:ring-2 peer-focus-visible:ring-[#FF5A26] peer-focus-visible:ring-offset-2" />
                    <span className="absolute left-0.5 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!isPending && !isError && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => save.mutate(payload)}
            disabled={!dirty || save.isPending}
            className="h-10 rounded-lg bg-[#FF5A26] px-4 text-sm font-semibold text-white transition hover:bg-[#E64F1F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A26] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {save.isPending ? "Saving…" : "Save preferences"}
          </button>
          {save.isSuccess && !dirty && <p className="text-sm font-semibold text-[#15803D]">Preferences saved.</p>}
          {save.isError && (
            <p role="alert" className="text-sm text-[#DC2626]">
              {errorMessage(save.error, "Couldn't save notification preferences.")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
