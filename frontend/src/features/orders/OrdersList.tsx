import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Ban, CheckCircle2, Eye, Search } from "lucide-react";
import Pagination from "../../components/ui/Pagination";
import RowActionsMenu from "../../components/ui/RowActionsMenu";
import type { MenuAction } from "../../components/ui/RowActionsMenu";
import { useAuth } from "../../context/auth/useAuth";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { ORDERS_PATH, formatDate, formatMoney, formatNumber, orderPath } from "./format";
import { useMyOrders, useOrders } from "./hooks";
import OrderActionDialog from "./OrderActionDialog";
import type { ActionTarget } from "./OrderActionDialog";
import { STATUSES, STATUS_LABEL, getOrderActions } from "./status";
import StatusBadge from "./StatusBadge";
import type {
  CustomerOrder,
  MyOrderListParams,
  OrderListParams,
  OrderScope,
  OrderStatus,
  StaffOrder,
} from "./types";

const PAGE_SIZE = 10;

const control =
  "h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:border-[#FF5615] focus:outline-none focus:ring-2 focus:ring-[#FF5615]/25";

type Row = CustomerOrder | StaffOrder;

/** Customer scope shows the recipient; staff scope shows the customer. */
const customerLabel = (order: Row, scope: OrderScope) =>
  scope === "my" ? (order as CustomerOrder).recipientName : (order as StaffOrder).customerName;

/**
 * Role-aware orders list.
 *   scope="my"     → GET /orders/mine (customer-safe shape, status filter only)
 *   scope="staff"  → GET /orders (staff shape, search + status + date filters)
 *
 * Actions always come from getOrderActions(role, order); the list never
 * derives them from the status alone.
 */
export default function OrdersList({ scope = "staff", basePath = ORDERS_PATH }: { scope?: OrderScope; basePath?: string }) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [status, setStatus] = useState<"" | OrderStatus>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<ActionTarget | null>(null);

  const myParams: MyOrderListParams = { status, page, pageSize: PAGE_SIZE };
  const staffParams: OrderListParams = { search, status, from, to, page, pageSize: PAGE_SIZE };

  const myQuery = useMyOrders(myParams, { enabled: scope === "my" });
  const staffQuery = useOrders(staffParams, { enabled: scope === "staff" });
  const { data, isPending, isError, isFetching, refetch } = scope === "my" ? myQuery : staffQuery;

  const orders: Row[] = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = page > totalPages ? totalPages : page;
  if (currentPage !== page) {
    setPage(currentPage);
  }

  const first = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const last = Math.min(currentPage * PAGE_SIZE, total);
  const filtered = scope === "my" ? !!status : !!(searchInput || status || from || to);

  const actionsFor = (order: Row): MenuAction[] => {
    const allowed = getOrderActions(role, order);
    const ref = {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      customerName: scope === "staff" ? (order as StaffOrder).customerName : undefined,
    };
    return [
      { label: "View details", icon: Eye, onSelect: () => navigate(orderPath(order.id, basePath)) },
      ...(allowed.includes("confirm")
        ? [{ label: "Confirm order", icon: CheckCircle2, onSelect: () => setTarget({ action: "confirm" as const, scope, order: ref }) }]
        : []),
      ...(allowed.includes("cancel")
        ? [{ label: "Cancel order", icon: Ban, danger: true, onSelect: () => setTarget({ action: "cancel" as const, scope, order: ref }) }]
        : []),
    ];
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        {scope === "staff" && (
          <div className="relative min-w-56 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setPage(1);
              }}
              aria-label="Search orders"
              placeholder="Search by order number or customer…"
              className={`${control} w-full pl-9`}
            />
          </div>
        )}
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "" | OrderStatus);
            setPage(1);
          }}
          aria-label="Filter by status"
          className={control}
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {scope === "staff" && (
          <>
            <label className="flex items-center gap-2 text-xs font-semibold text-[#6B7280]">
              From
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
                className={control}
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-[#6B7280]">
              To
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
                className={control}
              />
            </label>
          </>
        )}
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setStatus("");
              setFrom("");
              setTo("");
              setPage(1);
            }}
            className="h-10 text-sm font-semibold text-[#FF5615] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
        {isPending ? (
          <p role="status" className="p-10 text-center text-sm text-[#6B7280]">
            Loading orders…
          </p>
        ) : isError ? (
          <div role="alert" className="p-10 text-center text-sm">
            <p className="text-[#DC2626]">Couldn’t load orders.</p>
            <button type="button" onClick={() => refetch()} className="mt-2 font-semibold text-[#FF5615] hover:underline">
              Try again
            </button>
          </div>
        ) : orders.length === 0 ? (
          <p className="p-10 text-center text-sm text-[#6B7280]">{filtered ? "No orders match these filters." : "No orders yet."}</p>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${isFetching ? "opacity-60" : ""}`} aria-busy={isFetching}>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#F8F8F8] text-xs font-semibold text-[#6B7280]">
                <tr>
                  <th className="px-4 py-3">Order ID</th>
                  {scope === "staff" && <th className="px-4 py-3">Customer</th>}
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3">
                      <Link to={orderPath(o.id, basePath)} className="font-semibold text-[#111827] hover:text-[#FF5615] hover:underline">
                        {formatNumber(o.orderNumber)}
                      </Link>
                    </td>
                    {scope === "staff" && <td className="px-4 py-3 text-[#374151]">{customerLabel(o, scope) || "—"}</td>}
                    <td className="whitespace-nowrap px-4 py-3 text-[#6B7280]">{formatDate(o.createdAt)}</td>
                    <td className="px-4 py-3 font-semibold text-[#111827]">{formatMoney(o.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <RowActionsMenu label={`Actions for ${formatNumber(o.orderNumber)}`} actions={actionsFor(o)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F3F4F6] px-4 py-3">
            <p className="text-xs text-[#6B7280]">
              Showing {first}–{last} of {total} {total === 1 ? "order" : "orders"}
            </p>
            {totalPages > 1 && <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />}
          </div>
        )}
      </div>

      <OrderActionDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
