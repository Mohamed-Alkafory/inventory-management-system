import { Bell, Boxes, ClipboardList, LayoutDashboard, Package, PlusCircle, Settings, ShoppingBag, UserRound } from "lucide-react";
import AreaLayout from "../../components/layout/AreaLayout";
import type { AreaNavItem } from "../../components/layout/AreaLayout";

const NAV: AreaNavItem[] = [
  { to: "/staff", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/staff/orders", label: "Orders", icon: ShoppingBag },
  { to: "/staff/orders/new", label: "New order", icon: PlusCircle },
  { to: "/staff/inventory", label: "Inventory", icon: Boxes },
  { to: "/staff/purchase-orders", label: "Purchase orders", icon: ClipboardList },
  { to: "/staff/products", label: "Products", icon: Package },
  { to: "/staff/notifications", label: "Notifications", icon: Bell },
  { to: "/staff/profile", label: "Profile", icon: UserRound },
  { to: "/staff/settings", label: "Settings", icon: Settings },
];

/** Shell for /staff/* (ADMIN and STAFF). */
export default function StaffLayout() {
  return <AreaLayout title="Staff workspace" menuLabel="Staff menu" ariaLabel="Staff" navItems={NAV} />;
}
