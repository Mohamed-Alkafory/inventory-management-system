import type { ReactNode } from "react";
import { Bell, Menu, Search } from "lucide-react";
import UserMenu from "./UserMenu";

interface TopbarProps {
  onMenuClick: () => void;
  menuOpen: boolean;
  /** Slot for the notification bell. Pass your own component later; defaults to a plain bell button. */
  notifications?: ReactNode;
}

export default function Topbar({ onMenuClick, menuOpen, notifications }: TopbarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-[#E3EDF9] bg-white px-4 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open menu"
        aria-expanded={menuOpen}
        aria-controls="app-sidebar"
        className="rounded-lg p-2 text-[#0E2A66] hover:bg-[#F4F9FE] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A26] lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Search box (placeholder – not wired yet) */}
      <div className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5576AE]" />
        <input
          type="search"
          aria-label="Search"
          placeholder="Search products, orders, suppliers…"
          className="h-10 w-full rounded-lg border border-[#D7EAF8] bg-[#F7FBFE] pl-9 pr-3 text-sm text-[#0E2A66] placeholder:text-[#92AED1] focus:border-[#FF5A26] focus:outline-none focus:ring-2 focus:ring-[#FF5A26]/20"
        />
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        {notifications ?? (
          <button
            type="button"
            aria-label="Notifications"
            className="rounded-full p-2 text-[#5576AE] hover:bg-[#F4F9FE] hover:text-[#0E2A66] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A26]"
          >
            <Bell className="h-5 w-5" />
          </button>
        )}
        <UserMenu />
      </div>
    </header>
  );
}
