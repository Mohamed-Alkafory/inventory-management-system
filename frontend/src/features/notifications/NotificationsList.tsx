import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCheck, Inbox, MailOpen } from "lucide-react";
import Pagination from "../../components/ui/Pagination";
import { useAuth } from "../../context/auth/useAuth";
import { cn } from "../../lib/cn";
import { errorMessage } from "../../lib/errorMessage";
import { notificationPath, relativeTime, exactTime } from "./format";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from "./hooks";
import { NOTIFICATION_TYPE_LABEL } from "./types";
import type { NotificationItem } from "./types";

const PAGE_SIZE = 10;

export default function NotificationsList() {
  const { role } = useAuth();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const params = {
    page,
    pageSize: PAGE_SIZE,
    ...(unreadOnly ? { unread: true } : {}),
    sortBy: "createdAt" as const,
    sortOrder: "desc" as const,
  };
  const { data, isPending, isError, error, isFetching, refetch } = useNotifications(params);
  const unread = useUnreadCount(true);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;
  if (totalPages > 0 && page > totalPages) setPage(totalPages);

  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  const unreadCount = unread.data ?? 0;

  const openItem = async (notification: NotificationItem) => {
    const target = role ? notificationPath(notification, role) : null;
    try {
      await markRead.mutateAsync(notification.id);
    } catch {
      return;
    }
    if (target) navigate(target);
  };

  const markItemRead = (notification: NotificationItem) => {
    if (notification.isRead || markRead.isPending) return;
    markRead.mutate(notification.id);
  };

  return (
    <section aria-labelledby="notifications-heading" className="text-ink">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="notifications-heading" className="text-2xl font-extrabold text-[#111827]">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">Order updates, stock alerts and support messages.</p>
        </div>
        <button
          type="button"
          onClick={() => markAll.mutate()}
          disabled={unreadCount === 0 || markAll.isPending}
          className="flex h-10 items-center gap-2 rounded-lg bg-[#FF5A26] px-4 text-sm font-semibold text-white transition hover:bg-[#E64F1F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A26] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CheckCheck className="size-4" aria-hidden="true" />
          {markAll.isPending ? "Marking…" : "Mark all as read"}
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <label className="flex h-10 items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-[#374151]">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(event) => {
              setUnreadOnly(event.target.checked);
              setPage(1);
            }}
            className="size-4 accent-[#FF5A26]"
          />
          Unread only
        </label>
        {unreadCount > 0 && (
          <p className="text-sm text-[#6B7280]">
            <span className="font-semibold text-[#111827]">{unreadCount}</span> unread
          </p>
        )}
        {markRead.isError && (
          <p role="alert" className="text-sm text-[#DC2626]">
            {errorMessage(markRead.error, "Couldn't mark the notification as read.")}
          </p>
        )}
        {markAll.isError && (
          <p role="alert" className="text-sm text-[#DC2626]">
            {errorMessage(markAll.error, "Couldn't mark all notifications as read.")}
          </p>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
        {isPending ? (
          <p role="status" className="p-10 text-center text-sm text-[#6B7280]">
            Loading notifications…
          </p>
        ) : isError ? (
          <div role="alert" className="p-10 text-center text-sm">
            <p className="text-[#DC2626]">{errorMessage(error, "Couldn't load notifications.")}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-2 font-semibold text-[#FF5A26] hover:underline"
            >
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <Inbox className="mx-auto size-8 text-[#92AED1]" aria-hidden="true" />
            <p className="mt-2 text-sm text-[#6B7280]">
              {unreadOnly ? "You're all caught up — no unread notifications." : "You have no notifications yet."}
            </p>
          </div>
        ) : (
          <div className={cn("transition-opacity", isFetching && "opacity-60")} aria-busy={isFetching}>
            <ul className="divide-y divide-[#F3F4F6]">
              {items.map((notification) => {
                const target = role ? notificationPath(notification, role) : null;
                return (
                <li key={notification.id} className="flex gap-3 px-4 py-4 sm:px-5">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-1.5 size-2.5 shrink-0 rounded-full",
                      notification.isRead ? "bg-transparent" : "bg-[#FF5A26]",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void openItem(notification)}
                        className={cn(
                          "text-left text-sm hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A26]",
                          notification.isRead ? "font-semibold text-[#374151]" : "font-bold text-[#111827]",
                        )}
                      >
                        {notification.title || "Notification"}
                      </button>
                      <span className="rounded-full bg-[#F4F9FE] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#5576AE]">
                        {NOTIFICATION_TYPE_LABEL[notification.type]}
                      </span>
                      {!notification.isRead && (
                        <span className="rounded-full bg-[#FDEEE8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#FF5A26]">
                          Unread
                        </span>
                      )}
                      <time
                        dateTime={notification.createdAt}
                        title={exactTime(notification.createdAt)}
                        className="ml-auto shrink-0 text-xs text-[#92AED1]"
                      >
                        {relativeTime(notification.createdAt)}
                      </time>
                    </div>
                    <p className="mt-1 text-sm text-[#6B7280]">{notification.message}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {!notification.isRead && (
                        <button
                          type="button"
                          onClick={() => markItemRead(notification)}
                          aria-label={`Mark ${notification.title || "notification"} as read`}
                          className="flex items-center gap-1 text-xs font-semibold text-[#FF5A26] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A26]"
                        >
                          <MailOpen className="size-3.5" aria-hidden="true" />
                          Mark as read
                        </button>
                      )}
                      {target && (
                        <button
                          type="button"
                          onClick={() => void openItem(notification)}
                          className="text-xs font-semibold text-[#5576AE] hover:text-[#0E2A66] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5576AE]"
                        >
                          Open
                        </button>
                      )}
                    </div>
                  </div>
                </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#6B7280]">
            Showing {first}–{last} of {total}
          </p>
          <Pagination page={page} totalPages={Math.max(1, totalPages)} onChange={setPage} />
        </div>
      )}
    </section>
  );
}
