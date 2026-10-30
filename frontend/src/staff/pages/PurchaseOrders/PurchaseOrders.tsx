import PurchaseOrdersList from "../../../features/purchase-orders/PurchaseOrdersList";
import { STAFF_PO_PATH } from "../../../features/purchase-orders/format";

/** Staff purchase orders: read + receive only; create/status actions are hidden. */
export default function StaffPurchaseOrders() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-[#111827]">Purchase Orders</h1>
      <p className="mt-1 text-sm text-[#6B7280]">Track supplier deliveries and receive stock</p>
      <div className="mt-6">
        <PurchaseOrdersList basePath={STAFF_PO_PATH} />
      </div>
    </div>
  );
}
