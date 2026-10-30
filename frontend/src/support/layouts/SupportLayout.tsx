import { Bell, LayoutDashboard, Mail, Package, Settings, ShoppingBag, UserRound } from "lucide-react";
import AreaLayout from "../../components/layout/AreaLayout";
import type { AreaNavItem } from "../../components/layout/AreaLayout";

const NAV: AreaNavItem[] = [
  { to: "/support", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/support/messages", label: "Messages", icon: Mail },
  { to: "/support/orders", label: "Orders", icon: ShoppingBag },
  { to: "/support/products", label: "Products", icon: Package },
  { to: "/support/notifications", label: "Notifications", icon: Bell },
  { to: "/support/profile", label: "Profile", icon: UserRound },
  { to: "/support/settings", label: "Settings", icon: Settings },
];

/** Shell for /support/* (ADMIN and SUPPORT). */
export default function SupportLayout() {
  return <AreaLayout title="Support workspace" menuLabel="Support menu" ariaLabel="Support" navItems={NAV} />;
}
