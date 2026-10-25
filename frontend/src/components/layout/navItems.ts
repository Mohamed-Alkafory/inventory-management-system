import {
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Package,
  Settings,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Role } from "../../auth/auth-context";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Omit for links every signed-in user can see. */
  roles?: Role[];
}

export const navItems: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Products", to: "/products", icon: Package },
  { label: "Inventory", to: "/inventory", icon: Boxes },
  { label: "Orders", to: "/orders", icon: ClipboardList },
  { label: "Suppliers", to: "/suppliers", icon: Truck },
  { label: "Reports", to: "/reports", icon: BarChart3 },
  { label: "Settings", to: "/settings", icon: Settings },
  // admin-only
  { label: "Users", to: "/users", icon: Users, roles: ["admin"] },
  { label: "Audit Log", to: "/audit-log", icon: ShieldCheck, roles: ["admin"] },
];
