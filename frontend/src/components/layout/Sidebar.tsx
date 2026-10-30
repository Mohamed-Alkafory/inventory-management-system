import { NavLink } from "react-router-dom";
import { X } from "lucide-react";
import { APP_NAME } from "../../config";
import { useAuth } from "../../auth/useAuth";
import { navItems } from "./navItems";
import type { NavItem } from "./navItems";

function Item({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A26] ${
          isActive
            ? "bg-[#FF5A26] text-white shadow-md shadow-[#FF5A26]/25"
            : "text-[#5576AE] hover:bg-[#FDEEE8] hover:text-[#FF5A26]"
        }`
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      {item.label}
    </NavLink>
  );
}

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();

  // Role-based links: keep items with no `roles`, or whose roles include the user's role.
  const visible = navItems.filter((i) => !i.roles || (user && i.roles.includes(user.role)));
  const main = visible.filter((i) => !i.roles);
  const admin = visible.filter((i) => i.roles);

  return (
    <>
      {/* Mobile overlay */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-30 bg-black/40 transition-opacity lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[#E3EDF9] bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF5A26] text-sm font-extrabold text-white">
              {APP_NAME.charAt(0)}
            </span>
            <span className="text-lg font-extrabold tracking-wide text-[#0E2A66]">{APP_NAME.toUpperCase()}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-md p-1.5 text-[#5576AE] hover:bg-[#F4F9FE] hover:text-[#0E2A66] lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {main.map((i) => (
            <Item key={i.to} item={i} />
          ))}

          {admin.length > 0 && (
            <>
              <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-widest text-[#92AED1]">
                Administration
              </p>
              {admin.map((i) => (
                <Item key={i.to} item={i} />
              ))}
            </>
          )}
        </nav>
      </aside>
    </>
  );
}