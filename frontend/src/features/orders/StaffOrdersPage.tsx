import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { USE_MOCK } from "./api";
import OrdersList from "./OrdersList";
import { STAFF_ORDERS_PATH } from "./format";

/** Shared staff-scope order list. Admin/support can reuse it with another base path. */
export default function StaffOrdersPage({
  basePath = STAFF_ORDERS_PATH,
  newOrderPath = `${STAFF_ORDERS_PATH}/new`,
  showNewOrder = true,
}: {
  basePath?: string;
  newOrderPath?: string;
  /** SUPPORT can read orders but must not be offered the staff till. */
  showNewOrder?: boolean;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#111827]">Orders</h1>
          <p className="mt-1 text-sm text-[#6B7280]">Manage and track customer orders</p>
          {USE_MOCK && (
            <p className="mt-2 inline-block rounded-full bg-[#FFF1EB] px-2.5 py-1 text-[11px] font-semibold text-[#FF5615]">
              Demo data (mock API)
            </p>
          )}
        </div>
        {showNewOrder && (
          <Link
            to={newOrderPath}
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF5615] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#FF5615]/25 hover:bg-[#E84A0E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615] focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            New order
          </Link>
        )}
      </div>
      <div className="mt-6">
        <OrdersList scope="staff" basePath={basePath} />
      </div>
    </div>
  );
}
