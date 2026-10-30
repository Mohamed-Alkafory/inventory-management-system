import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Ban, CheckCircle2 } from "lucide-react";
import { ApiError } from "../../lib/http";
import { can } from "../../lib/permissions";
import { useAuth } from "../../context/auth/useAuth";
import { ORDERS_PATH, formatDateTime, formatMoney, formatNumber } from "./format";
import { useMyOrder, useOrder } from "./hooks";
import OrderActionDialog from "./OrderActionDialog";
import OrderNotesPanel from "./OrderNotesPanel";
import type { ActionTarget } from "./OrderActionDialog";
import { ACTION_RULES, getOrderActions } from "./status";
import StatusBadge from "./StatusBadge";
import type { CustomerOrder, OrderScope, StaffOrder } from "./types";

const card = "rounded-2xl border border-[#E5E7EB] bg-white";

function BackLink({ to }: { to: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6B7280] hover:text-[#FF5615]">
      <ArrowLeft className="h-4 w-4" />
      Back to orders
    </Link>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[11px] font-semibold text-[#6B7280]">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-[#111827]">{value}</dd>
    </div>
  );
}

/**
 * Role-aware order details.
 *   scope="my"    → GET /orders/mine/:id (customer-safe fields only)
 *   scope="staff" → GET /orders/:id (staff fields, optional for SUPPORT rows)
 *
 * Empty/undefined personal fields are never rendered.
 */
export default function OrderDetailsView({
  id,
  scope = "staff",
  basePath = ORDERS_PATH,
}: {
  id: string;
  scope?: OrderScope;
  basePath?: string;
}) {
  const { role } = useAuth();
  const myQuery = useMyOrder(id, { enabled: scope === "my" });
  const staffQuery = useOrder(id, { enabled: scope === "staff" });
  const { data: order, isPending, isError, error, refetch } = scope === "my" ? myQuery : staffQuery;
  const [target, setTarget] = useState<ActionTarget | null>(null);

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <BackLink to={basePath} />
        <p role="status" className="py-10 text-center text-sm text-[#6B7280]">
          Loading order…
        </p>
      </div>
    );
  }

  if (isError || !order) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <BackLink to={basePath} />
        <div role="alert" className="py-10 text-center text-sm">
          <p className={missing ? "font-semibold text-[#111827]" : "text-[#DC2626]"}>{missing ? "Order not found" : "Couldn’t load this order."}</p>
          {missing ? (
            <p className="mt-1 text-[#6B7280]">It may have been removed, or the link is wrong.</p>
          ) : (
            <button type="button" onClick={() => refetch()} className="mt-2 font-semibold text-[#FF5615] hover:underline">
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  const allowed = getOrderActions(role, order);
  const ref = {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    customerName: scope === "staff" ? (order as StaffOrder).customerName : undefined,
  };
  const items = order.items ?? [];
  const customer = scope === "my" ? (order as CustomerOrder) : null;
  const staff = scope === "staff" ? (order as StaffOrder) : null;
  // Notes and the audit notice only exist inside the back-office order screens.
  const showNotes = scope === "staff" && can(role, "orders.notes.read");
  const auditedVisit = scope === "staff" && (role === "SUPPORT" || role === "STAFF");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
      <BackLink to={basePath} />

      {auditedVisit && (
        <p
          role="note"
          className="mt-4 rounded-lg border border-[#E5E7EB] bg-[#F8F8F8] px-3 py-2 text-xs text-[#6B7280]"
        >
          Opening this order is recorded. Personal data access is audited.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-extrabold text-[#111827]">Order {formatNumber(order.orderNumber)}</h1>
          <StatusBadge status={order.status} />
        </div>
        {allowed.length > 0 && (
          <div className="flex gap-2">
            {allowed.includes("confirm") && (
              <button
                type="button"
                onClick={() => setTarget({ action: "confirm", scope, order: ref })}
                className="inline-flex items-center gap-2 rounded-lg bg-[#FF5615] px-3.5 py-2 text-[13px] font-semibold text-white shadow-md shadow-[#FF5615]/25 hover:bg-[#E84A0E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615] focus-visible:ring-offset-2"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {ACTION_RULES.confirm.label}
              </button>
            )}
            {allowed.includes("cancel") && (
              <button
                type="button"
                onClick={() => setTarget({ action: "cancel", scope, order: ref })}
                className="inline-flex items-center gap-2 rounded-lg border border-[#FECACA] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#DC2626] hover:bg-[#FEF2F2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]"
              >
                <Ban className="h-3.5 w-3.5" />
                {ACTION_RULES.cancel.label}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section aria-labelledby="items-h" className={`${card} overflow-hidden`}>
            <h2 id="items-h" className="px-4 py-3 text-sm font-bold text-[#111827]">
              Items
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-[13px]">
                <thead className="bg-[#F8F8F8] text-[11px] font-semibold text-[#6B7280]">
                  <tr>
                    <th className="px-4 py-2.5">Product</th>
                    <th className="px-4 py-2.5">SKU</th>
                    <th className="px-4 py-2.5 text-right">Qty</th>
                    <th className="px-4 py-2.5 text-right">Unit price</th>
                    <th className="px-4 py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {items.map((i, n) => (
                    <tr key={`${i.sku}-${n}`}>
                      <td className="px-4 py-2.5 font-semibold text-[#111827]">{i.productName || "—"}</td>
                      <td className="px-4 py-2.5 text-[#6B7280]">{i.sku || "—"}</td>
                      <td className="px-4 py-2.5 text-right text-[#374151]">{i.quantity}</td>
                      <td className="px-4 py-2.5 text-right text-[#374151]">{formatMoney(i.unitPrice)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-[#111827]">{formatMoney(i.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="ml-auto w-full max-w-xs space-y-1.5 border-t border-[#F3F4F6] px-4 py-3 text-[13px] sm:mr-0">
              <div className="flex justify-between text-sm font-extrabold">
                <dt className="text-[#111827]">Total</dt>
                <dd className="text-[#111827]">{formatMoney(order.totalAmount)}</dd>
              </div>
            </dl>
          </section>

          {showNotes && <OrderNotesPanel orderId={order.id} canWrite={can(role, "orders.notes.write")} />}
        </div>

        <div className="space-y-4">
          <section aria-labelledby="summary-h" className={`${card} p-4`}>
            <h2 id="summary-h" className="text-sm font-bold text-[#111827]">
              Order summary
            </h2>
            <dl className="mt-3 space-y-2.5 text-[13px]">
              {staff && <Field label="Customer" value={staff.customerName} />}
              {staff && <Field label="Customer phone" value={staff.customerPhone} />}
              {customer && <Field label="Recipient" value={customer.recipientName} />}
              <Field label="Placed on" value={formatDateTime(order.createdAt)} />
              {order.cancelledAt && <Field label="Cancelled on" value={formatDateTime(order.cancelledAt)} />}
              <Field label="Payment method" value={order.paymentMethod} />
              {customer && <Field label="Recipient phone" value={customer.recipientPhone} />}
              {staff && <Field label="Notes" value={staff.notes} />}
              {staff?.createdBy?.name && <Field label="Created by" value={staff.createdBy.name} />}
            </dl>
          </section>

          {(order.shippingAddress || order.shippingCity) && (
            <section aria-labelledby="shipping-h" className={`${card} p-4`}>
              <h2 id="shipping-h" className="text-sm font-bold text-[#111827]">
                Shipping
              </h2>
              <dl className="mt-3 space-y-2.5 text-[13px]">
                <Field label="Address" value={order.shippingAddress} />
                <Field label="City" value={order.shippingCity} />
              </dl>
            </section>
          )}
        </div>
      </div>

      <OrderActionDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
