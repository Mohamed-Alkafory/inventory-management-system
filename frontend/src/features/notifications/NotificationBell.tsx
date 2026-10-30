import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { useAuth } from "../../context/auth/useAuth";
import { cn } from "../../lib/cn";
import { notificationPath, relativeTime, exactTime, unreadBadgeLabel } from "./format";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from "./hooks";
import type { NotificationItem } from "./types";

const DROPDOWN_PAGE_SIZE = 6;

/**
 * Shared notification bell: used by the shop header and by the admin, staff
 * and support top bars. Shows the unread badge, polls the count while signed
 * in and visible, and opens a keyboard-accessible dropdown of recent rows.
 */
export default function NotificationBell({
  className,
  viewAllPath = "/notifications",
}: {
  className?: string;
  /** Where "View all" points — area-aware so it stays inside the current dashboard. */
  viewAllPath?: string;
}) {
  const { isAuthenticated, role } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  const unread = useUnreadCount(isAuthenticated);
  const recent = useNotifications(
    { page: 1, pageSize: DROPDOWN_PAGE_SIZE, sortBy: "createdAt", sortOrder: "desc" },
    isAuthenticated && open,
  );
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const count = unread.data ?? 0;
  const badge = unreadBadgeLabel(count);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!isAuthenticated) return null;

  const close = () => setOpen(false);

  const openItem = async (notification: NotificationItem) => {
    const target = role ? notificationPath(notification, role) : null;
    close();
    try {
      await markRead.mutateAsync(notification.id);
    } catch {
      // A missing/foreign notification (404) must not crash the UI; stay put.
      return;
    }
    if (target) navigate(target);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      close();
      buttonRef.current?.focus();
    }
  };

  const items = recent.data?.items ?? [];

  return (
    <div ref={rootRef} className={cn("relative", className)} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative flex size-10 items-center justify-center rounded-full text-[#0E2A66] transition hover:bg-[#F4F9FE] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A26]"
      >
        <Bell className="size-5" aria-hidden="true" />
        {count > 0 && (
          <span
            data-testid="notification-badge"
            className="absolute right-0 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-[#FF5A26] px-1 text-[10px] font-bold leading-none text-white"
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 z-[70] mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#E3EDF9] bg-white shadow-lg shadow-[#0E2A66]/10"
        >
          <div className="flex items-center justify-between border-b border-[#E3EDF9] px-4 py-3">
            <p className="text-sm font-bold text-[#0E2A66]">Notifications</p>
            <button
              type="button"
              role="menuitem"
              onClick={() => markAll.mutate()}
              disabled={count === 0 || markAll.isPending}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-[#FF5A26] hover:bg-[#FDEEE8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A26] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCheck className="size-3.5" aria-hidden="true" />
              Mark all as read
            </button>
          </div>

          {recent.isPending ? (
            <p role="status" className="px-4 py-8 text-center text-sm text-[#5576AE]">
              Loading notifications…
            </p>
          ) : recent.isError ? (
            <div className="px-4 py-8 text-center text-sm">
              <p className="text-[#DC2626]">Couldn't load notifications.</p>
              <button
                type="button"
                role="menuitem"
                onClick={() => void recent.refetch()}
                className="mt-1 font-semibold text-[#FF5A26] hover:underline"
              >
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#5576AE]">You have no notifications yet.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {items.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void openItem(notification)}
                    className="flex w-full gap-2.5 px-4 py-2.5 text-left transition hover:bg-[#F4F9FE] focus:outline-none focus-visible:bg-[#F4F9FE]"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        notification.isRead ? "bg-transparent" : "bg-[#FF5A26]",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-[#0E2A66]">
                          {notification.title || "Notification"}
                        </span>
                        <time
                          dateTime={notification.createdAt}
                          title={exactTime(notification.createdAt)}
                          className="shrink-0 text-[11px] text-[#92AED1]"
                        >
                          {relativeTime(notification.createdAt)}
                        </time>
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-[#5576AE]">
                        {notification.message}
                      </span>
                    </span>
                    {!notification.isRead && <span className="sr-only">Unread</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-[#E3EDF9] px-4 py-2.5 text-center">
            <Link
              to={viewAllPath}
              role="menuitem"
              onClick={close}
              className="text-sm font-semibold text-[#FF5A26] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A26]"
            >
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
