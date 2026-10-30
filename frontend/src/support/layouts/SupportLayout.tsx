import { LayoutDashboard } from "lucide-react";
import AreaLayout from "../../components/layout/AreaLayout";
import type { AreaNavItem } from "../../components/layout/AreaLayout";

const NAV: AreaNavItem[] = [{ to: "/support", label: "Dashboard", icon: LayoutDashboard, end: true }];

/** Shell for /support/* (ADMIN and SUPPORT). */
export default function SupportLayout() {
  return <AreaLayout title="Support workspace" menuLabel="Support menu" ariaLabel="Support" navItems={NAV} />;
}
