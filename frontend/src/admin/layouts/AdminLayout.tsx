import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Boxes, ClipboardList, FolderTree, LayoutDashboard, Menu, Package, ScrollText, Truck, Users as UsersIcon, X } from "lucide-react";
import { useAuth } from "../../context/auth/useAuth";
import { cn } from "../../lib/cn";
import UserAvatar from "../../components/user/UserAvatar";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/products", label: "Products", icon: Package, end: false },
  { to: "/admin/inventory", label: "Inventory", icon: Boxes, end: false },
  { to: "/admin/purchase-orders", label: "Purchase Orders", icon: ClipboardList, end: false },
  { to: "/admin/categories", label: "Categories", icon: FolderTree, end: false },
  { to: "/admin/suppliers", label: "Suppliers", icon: Truck, end: false },
  { to: "/admin/users", label: "Users", icon: UsersIcon, end: false },
  { to: "/admin/audit-logs", label: "Audit Log", icon: ScrollText, end: false },
] as const;

/** Shell for every /admin page: sidebar on desktop, slide-down menu on mobile. */
export default function AdminLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const links = (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-semibold transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
              isActive ? "bg-primary-50 text-primary-700" : "text-muted hover:bg-surface-alt hover:text-ink",
            )
          }
        >
          <Icon className="size-5 shrink-0" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-[calc(100vh-128px)] bg-surface-alt text-ink lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-line bg-surface lg:block">
        <div className="sticky top-[128px] p-4">
          <p className="px-3 pb-3 text-xs font-semibold uppercase tracking-wide text-muted">Admin panel</p>
          {links}
          <div className="mt-6 rounded-control border border-line bg-surface-alt px-3 py-3 text-xs text-muted">
            <p className="text-[11px] font-semibold uppercase tracking-wide">Signed in as</p>
            <div className="mt-2 flex items-center gap-2.5">
              <UserAvatar name={user?.name} src={user?.avatarUrl} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
                <p className="truncate">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile bar */}
      <div className="border-b border-line bg-surface lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold"
        >
          <span>Admin menu</span>
          {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        </button>
        {open && <div className="border-t border-line p-3">{links}</div>}
      </div>

      <main className="min-w-0 px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
