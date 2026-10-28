import { useEffect } from "react";
import { Bell } from "lucide-react";
import { Button, IconBadge, useToast } from "../../components/ui";
import { toApiError } from "../../api/errors";
import { NOTIFICATION_LABELS } from "../../features/notifications/types";
import type { NotificationPreference } from "../../features/notifications/types";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "../../features/notifications/hooks";

/** Accessible switch button (role="switch") styled with the app tokens. */
function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? "bg-primary-600" : "bg-slate-300"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 motion-reduce:transition-none ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

/**
 * Notifications tab: per-type on/off switches backed by
 * `GET/PUT /notifications/preferences`. Each toggle flips optimistically and
 * rolls back — with a toast — when the save fails.
 */
export default function NotificationsTab() {
  const preferencesQuery = useNotificationPreferences();
  const save = useUpdateNotificationPreferences();
  const toast = useToast();

  // Surface a save failure (the hook has already rolled the toggle back).
  useEffect(() => {
    if (save.isError && save.error) {
      toast.error("Couldn't save preferences", toApiError(save.error).message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.isError, save.error]);

  const toggled = (preference: NotificationPreference) => {
    save.mutate([{ type: preference.type, enabled: !preference.enabled }]);
  };

  if (preferencesQuery.isPending) {
    return (
      <div className="rounded-control border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-base font-bold">Notification preferences</h2>
        <ul className="mt-4 space-y-2" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="h-12 animate-pulse rounded-control bg-surface-alt" />
          ))}
        </ul>
      </div>
    );
  }

  if (preferencesQuery.isError) {
    return (
      <div className="rounded-control border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-base font-bold">Notification preferences</h2>
        <div className="mt-4 rounded-control border border-danger-600/20 bg-danger-50 px-4 py-6 text-center text-sm text-danger-700">
          Couldn't load your notification preferences.
        </div>
        <div className="mt-4 text-center">
          <Button variant="secondary" onClick={() => void preferencesQuery.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const preferences = preferencesQuery.data ?? [];

  return (
    <div className="rounded-control border border-line bg-surface p-5 sm:p-6">
      <h2 className="text-base font-bold">Notification preferences</h2>
      <p className="mt-1 text-sm text-muted">
        Choose which notifications you want to receive. Changes are saved as soon as you flip a switch.
      </p>

      <ul className="mt-4 divide-y divide-line">
        {preferences.map((preference) => {
          const copy = NOTIFICATION_LABELS[preference.type];
          return (
            <li key={preference.type} className="flex items-center justify-between gap-4 py-3.5 first:pt-1 last:pb-0">
              <div className="flex min-w-0 items-start gap-3">
                <IconBadge className="hidden size-10 shrink-0 sm:flex">
                  <Bell className="size-5" aria-hidden="true" />
                </IconBadge>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{copy.title}</p>
                  <p className="text-xs text-muted">{copy.description}</p>
                </div>
              </div>
              <Toggle
                checked={preference.enabled}
                disabled={save.isPending}
                onChange={() => toggled(preference)}
                label={`${copy.title} notifications`}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
