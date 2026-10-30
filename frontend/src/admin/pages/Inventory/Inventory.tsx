import InventoryPage from "../../../features/inventory/InventoryPage";

/** Admin inventory: the shared page, with ADMIN-only actions from `can()`. */
export default function Inventory() {
  return <InventoryPage />;
}
