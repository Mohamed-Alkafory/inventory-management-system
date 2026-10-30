import {
  Bell,
  Heart,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  UserRound,
} from "lucide-react";
import AreaLayout from "../../components/layout/AreaLayout";
import type { AreaNavItem } from "../../components/layout/AreaLayout";

const NAV: AreaNavItem[] = [
  { to: "/dashboard/products", label: "Products", icon: Package },
  { to: "/dashboard/orders", label: "My orders", icon: ReceiptText },
  { to: "/dashboard/favorites", label: "Favorites", icon: Heart },
  { to: "/dashboard/cart", label: "Cart", icon: ShoppingCart },
  { to: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { to: "/dashboard/profile", label: "Profile", icon: UserRound },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

/** Shell for /dashboard/* — the CUSTOMER's personal area. */
export default function CustomerLayout() {
  return <AreaLayout title="My account" menuLabel="Account menu" ariaLabel="Customer" navItems={NAV} />;
}
