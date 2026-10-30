import { Link } from "react-router-dom";
import { AlertTriangle, ClipboardList, PackageX, ShoppingBag } from "lucide-react";
import { Card, CardBody } from "../../../components/ui/Card";
import { useInventory } from "../../../features/inventory/hooks";
import { useOrders } from "../../../features/orders/hooks";
import { STAFF_ORDERS_PATH } from "../../../features/orders/format";
import { STAFF_PO_PATH } from "../../../features/purchase-orders/format";
import { usePurchaseOrders } from "../../../features/purchase-orders/hooks";

const countQuery = { page: 1, pageSize: 1 };

function StatCard({
  label,
  value,
  hint,
  to,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | null;
  hint: string;
  to: string;
  icon: typeof ShoppingBag;
  tone: string;
}) {
  return (
    <Link to={to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615]">
      <Card className="h-full transition hover:shadow-md">
        <CardBody className="flex items-start gap-3 p-4">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">{label}</p>
            <p className="mt-0.5 text-2xl font-extrabold text-[#111827]">{value ?? "—"}</p>
            <p className="mt-0.5 text-xs text-[#6B7280]">{hint}</p>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}

/**
 * Staff landing page. Counts come from list endpoints STAFF may read
 * (orders, stock, purchase orders); the ADMIN-only /dashboard API is never used.
 */
export default function StaffDashboard() {
  const pending = useOrders({ search: "", status: "PENDING", from: "", to: "", ...countQuery });
  const lowStock = useInventory({ search: "", categoryId: "", status: "low_stock", ...countQuery });
  const outOfStock = useInventory({ search: "", categoryId: "", status: "out_of_stock", ...countQuery });
  const incoming = usePurchaseOrders({ status: "ordered", supplierId: "", ...countQuery });
  const partial = usePurchaseOrders({ status: "partially_received", supplierId: "", ...countQuery });

  const incomingCount =
    incoming.data && partial.data ? incoming.data.total + partial.data.total : incoming.data?.total ?? partial.data?.total ?? null;

  return (
    <div className="text-ink">
      <h1 className="text-2xl font-extrabold text-[#111827]">Staff dashboard</h1>
      <p className="mt-1 text-sm text-[#6B7280]">Today’s orders and stock at a glance</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pending orders"
          value={pending.data?.total ?? null}
          hint="Waiting to be confirmed"
          to={STAFF_ORDERS_PATH}
          icon={ShoppingBag}
          tone="bg-[#FFF1EB] text-[#FF5615]"
        />
        <StatCard
          label="Low stock"
          value={lowStock.data?.total ?? null}
          hint="At or below reorder point"
          to="/staff/inventory"
          icon={AlertTriangle}
          tone="bg-[#FFF7E6] text-[#B7791F]"
        />
        <StatCard
          label="Out of stock"
          value={outOfStock.data?.total ?? null}
          hint="Needs restocking"
          to="/staff/inventory"
          icon={PackageX}
          tone="bg-[#FEF2F2] text-[#DC2626]"
        />
        <StatCard
          label="Incoming deliveries"
          value={incomingCount}
          hint="Ordered or partially received"
          to={STAFF_PO_PATH}
          icon={ClipboardList}
          tone="bg-[#EEF2FF] text-[#4F46E5]"
        />
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link to={`${STAFF_ORDERS_PATH}/new`} className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm font-semibold text-[#111827] transition hover:border-[#FF5615] hover:text-[#FF5615]">
          Build a new order →
        </Link>
        <Link to={STAFF_ORDERS_PATH} className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm font-semibold text-[#111827] transition hover:border-[#FF5615] hover:text-[#FF5615]">
          Browse orders →
        </Link>
        <Link to="/staff/products" className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm font-semibold text-[#111827] transition hover:border-[#FF5615] hover:text-[#FF5615]">
          Product catalogue →
        </Link>
      </div>
    </div>
  );
}
