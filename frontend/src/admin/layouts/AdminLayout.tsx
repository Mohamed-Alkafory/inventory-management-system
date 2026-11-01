import {
  Bell,
  Boxes,
  ClipboardList,
  FileText,
  FolderTree,
  LayoutDashboard,
  Package,
  ScrollText,
  Settings,
  ShoppingBag,
  Truck,
  UserRound,
  Users as UsersIcon,
} from "lucide-react";
import AreaLayout from "../../components/layout/AreaLayout";
import type { AreaNavItem } from "../../components/layout/AreaLayout";

const NAV: AreaNavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/inventory", label: "Inventory", icon: Boxes },
  { to: "/admin/purchase-orders", label: "Purchase Orders", icon: ClipboardList },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/reports", label: "Reports", icon: FileText },
  { to: "/admin/categories", label: "Categories", icon: FolderTree },
  { to: "/admin/suppliers", label: "Suppliers", icon: Truck },
  { to: "/admin/users", label: "Users", icon: UsersIcon },
  { to: "/admin/audit-logs", label: "Audit Log", icon: ScrollText },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/profile", label: "Profile", icon: UserRound },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

/** Shell for every /admin page (ADMIN only). Same markup as before, built on AreaLayout. */
export default function AdminLayout() {
  return <AreaLayout title="Admin panel" menuLabel="Admin menu" ariaLabel="Admin" navItems={NAV} />;
}
