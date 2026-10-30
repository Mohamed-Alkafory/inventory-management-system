import { LayoutDashboard, Package, PlusCircle } from "lucide-react";
import AreaLayout from "../../components/layout/AreaLayout";
import type { AreaNavItem } from "../../components/layout/AreaLayout";

const NAV: AreaNavItem[] = [
  { to: "/staff", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/orders/new", label: "New order", icon: PlusCircle },
  { to: "/products", label: "Products", icon: Package },
];

/** Shell for /staff/* (ADMIN and STAFF). */
export default function StaffLayout() {
  return <AreaLayout title="Staff workspace" menuLabel="Staff menu" ariaLabel="Staff" navItems={NAV} />;
}
