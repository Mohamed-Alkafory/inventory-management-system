import PurchaseOrdersList from "../../../features/purchase-orders/PurchaseOrdersList";

export default function PurchaseOrders() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-[#111827]">Purchase Orders</h1>
      <p className="mt-1 text-sm text-[#6B7280]">Restock products from suppliers — order, track and receive</p>
      <div className="mt-6">
        <PurchaseOrdersList />
      </div>
    </div>
  );
}
