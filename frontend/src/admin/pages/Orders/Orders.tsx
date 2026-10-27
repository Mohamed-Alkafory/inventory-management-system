import { USE_MOCK } from "../../../features/orders/api";
import OrdersList from "../../../features/orders/OrdersList";

export default function Orders() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-[#111827]">Orders</h1>
      <p className="mt-1 text-sm text-[#6B7280]">Manage and track customer orders</p>
      {USE_MOCK && (
        <p className="mt-2 inline-block rounded-full bg-[#FFF1EB] px-2.5 py-1 text-[11px] font-semibold text-[#FF5615]">Demo data (mock API)</p>
      )}
      <div className="mt-6">
        <OrdersList />
      </div>
    </div>
  );
}
