import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Ban, CheckCircle2 } from "lucide-react";
import { ApiError } from "../../lib/http";
import { ORDERS_PATH, formatDateTime, formatMoney, formatNumber } from "./format";
import { useOrder } from "./hooks";
import OrderActionDialog from "./OrderActionDialog";
import type { ActionTarget } from "./OrderActionDialog";
import { ACTION_RULES, allowedActions } from "./status";
import StatusBadge from "./StatusBadge";

const card = "rounded-2xl border border-[#E5E7EB] bg-white";

function BackLink() {
  return (
    <Link to={ORDERS_PATH} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6B7280] hover:text-[#FF5615]">
      <ArrowLeft className="h-4 w-4" />
      Back to orders
    </Link>
  );
}

export default function OrderDetailsView({ id }: { id: string }) {
  const { data: order, isPending, isError, error, refetch } = useOrder(id);
  const [target, setTarget] = useState<ActionTarget | null>(null);

  if (isPending) {
    return (
      <div>
        <BackLink />
        <p role="status" className="p-10 text-center text-sm text-[#6B7280]">
          Loading order…
        </p>
      </div>
    );
  }

  if (isError) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <div>
        <BackLink />
        <div role="alert" className="p-10 text-center text-sm">
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

  const allowed = allowedActions(order);
  const ref = { id: order.id, number: order.number, customerName: order.customerName };
  const history = [...order.history].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div>
      <BackLink />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold text-[#111827]">Order {formatNumber(order.number)}</h1>
          <StatusBadge status={order.status} />
        </div>
        {allowed.length > 0 && (
          <div className="flex gap-2">
            {allowed.includes("confirm") && (
              <button
                type="button"
                onClick={() => setTarget({ action: "confirm", order: ref })}
                className="inline-flex items-center gap-2 rounded-lg bg-[#FF5615] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#FF5615]/25 hover:bg-[#E84A0E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615] focus-visible:ring-offset-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                {ACTION_RULES.confirm.label}
              </button>
            )}
            {allowed.includes("cancel") && (
              <button
                type="button"
                onClick={() => setTarget({ action: "cancel", order: ref })}
                className="inline-flex items-center gap-2 rounded-lg border border-[#FECACA] bg-white px-4 py-2.5 text-sm font-semibold text-[#DC2626] hover:bg-[#FEF2F2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]"
              >
                <Ban className="h-4 w-4" />
                {ACTION_RULES.cancel.label}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Items + totals */}
          <section aria-labelledby="items-h" className={`${card} overflow-hidden`}>
            <h2 id="items-h" className="px-5 py-4 text-base font-bold text-[#111827]">
              Items
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-[#F8F8F8] text-xs font-semibold text-[#6B7280]">
                  <tr>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">SKU</th>
                    <th className="px-5 py-3 text-right">Qty</th>
                    <th className="px-5 py-3 text-right">Unit price</th>
                    <th className="px-5 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {order.items.map((i, n) => (
                    <tr key={`${i.sku}-${n}`}>
                      <td className="px-5 py-3 font-semibold text-[#111827]">{i.name}</td>
                      <td className="px-5 py-3 text-[#6B7280]">{i.sku}</td>
                      <td className="px-5 py-3 text-right text-[#374151]">{i.quantity}</td>
                      <td className="px-5 py-3 text-right text-[#374151]">{formatMoney(i.unitPrice)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-[#111827]">{formatMoney(i.quantity * i.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="ml-auto w-full max-w-xs space-y-2 border-t border-[#F3F4F6] px-5 py-4 text-sm sm:mr-0">
              <div className="flex justify-between">
                <dt className="text-[#6B7280]">Subtotal</dt>
                <dd className="text-[#111827]">{formatMoney(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#6B7280]">Shipping</dt>
                <dd className="text-[#111827]">{order.shipping > 0 ? formatMoney(order.shipping) : "Free"}</dd>
              </div>
              {order.tax > 0 && (
                <div className="flex justify-between">
                  <dt className="text-[#6B7280]">Tax</dt>
                  <dd className="text-[#111827]">{formatMoney(order.tax)}</dd>
                </div>
              )}
              {order.discount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-[#6B7280]">Discount</dt>
                  <dd className="text-[#1F8F6B]">−{formatMoney(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-[#F3F4F6] pt-2 text-base font-extrabold">
                <dt className="text-[#111827]">Total</dt>
                <dd className="text-[#111827]">{formatMoney(order.total)}</dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="space-y-5">
          {/* Summary */}
          <section aria-labelledby="summary-h" className={`${card} p-5`}>
            <h2 id="summary-h" className="text-base font-bold text-[#111827]">
              Order summary
            </h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-semibold text-[#6B7280]">Customer</dt>
                <dd className="mt-0.5 font-semibold text-[#111827]">{order.customerName || "—"}</dd>
                {order.customerEmail && <dd className="text-[#6B7280]">{order.customerEmail}</dd>}
                {order.customerPhone && <dd className="text-[#6B7280]">{order.customerPhone}</dd>}
              </div>
              <div>
                <dt className="text-xs font-semibold text-[#6B7280]">Placed on</dt>
                <dd className="mt-0.5 text-[#111827]">{formatDateTime(order.createdAt)}</dd>
              </div>
              {order.notes && (
                <div>
                  <dt className="text-xs font-semibold text-[#6B7280]">Notes</dt>
                  <dd className="mt-0.5 whitespace-pre-line text-[#111827]">{order.notes}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-semibold text-[#6B7280]">Created by</dt>
                <dd className="mt-0.5 text-[#111827]">{order.createdBy || "—"}</dd>
              </div>
            </dl>
          </section>

          {/* Status history */}
          <section aria-labelledby="history-h" className={`${card} p-5`}>
            <h2 id="history-h" className="text-base font-bold text-[#111827]">
              Status history
            </h2>
            {history.length === 0 ? (
              <p className="mt-3 text-sm text-[#6B7280]">No status changes recorded.</p>
            ) : (
              <ol className="mt-4 space-y-4">
                {history.map((h, n) => (
                  <li key={`${h.at}-${n}`} className="relative pl-6">
                    <span aria-hidden="true" className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ${n === 0 ? "bg-[#FF5615]" : "bg-[#D1D5DB]"}`} />
                    {n < history.length - 1 && <span aria-hidden="true" className="absolute left-[4px] top-4 h-[calc(100%+0.25rem)] w-px bg-[#E5E7EB]" />}
                    <StatusBadge status={h.status} />
                    <p className="mt-1 text-xs text-[#6B7280]">
                      {formatDateTime(h.at)}
                      {h.by ? ` · ${h.by}` : ""}
                    </p>
                    {h.note && <p className="mt-0.5 text-sm text-[#374151]">{h.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>

      <OrderActionDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
