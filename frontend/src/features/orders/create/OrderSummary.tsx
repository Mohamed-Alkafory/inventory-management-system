import { formatMoney } from "../format";
import { lineTotal, orderTotal } from "./lines";
import type { CustomerFormValues } from "./schema";
import type { DraftLine } from "./types";

export default function OrderSummary({
  lines,
  customer,
  placing,
  error,
  onBack,
  onPlace,
}: {
  lines: DraftLine[];
  customer: CustomerFormValues;
  placing: boolean;
  error: string | null;
  onBack: () => void;
  onPlace: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section aria-labelledby="sum-customer-h" className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
        <h2 id="sum-customer-h" className="text-base font-bold text-[#111827]">
          Customer
        </h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold text-[#6B7280]">Name</dt>
            <dd className="mt-0.5 font-semibold text-[#111827]">{customer.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-[#6B7280]">Phone</dt>
            <dd className="mt-0.5 text-[#111827]">{customer.phone}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold text-[#6B7280]">Notes</dt>
            <dd className="mt-0.5 whitespace-pre-line text-[#111827]">{customer.notes || "—"}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="sum-items-h" className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
        <h2 id="sum-items-h" className="px-5 py-4 text-base font-bold text-[#111827]">
          Items
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-[#F8F8F8] text-xs font-semibold text-[#6B7280]">
              <tr>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3 text-right">Qty</th>
                <th className="px-5 py-3 text-right">Unit price</th>
                <th className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {lines.map((l) => (
                <tr key={l.product.id}>
                  <td className="px-5 py-3">
                    <p className="font-semibold text-[#111827]">{l.product.name}</p>
                    <p className="text-xs text-[#6B7280]">{l.product.sku}</p>
                  </td>
                  <td className="px-5 py-3 text-right text-[#374151]">{l.quantity}</td>
                  <td className="px-5 py-3 text-right text-[#374151]">{formatMoney(l.product.price)}</td>
                  <td className="px-5 py-3 text-right font-semibold text-[#111827]">{formatMoney(lineTotal(l))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-baseline justify-between border-t border-[#F3F4F6] px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-[#111827]">Estimated total</p>
            <p className="text-xs text-[#6B7280]">The server confirms the final total when the order is placed.</p>
          </div>
          <p className="text-xl font-extrabold text-[#111827]" data-testid="summary-total">
            {formatMoney(orderTotal(lines))}
          </p>
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={placing}
          className="rounded-lg border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615] disabled:opacity-60"
        >
          Back to edit
        </button>
        <button
          type="button"
          onClick={onPlace}
          disabled={placing}
          className="rounded-lg bg-[#FF5615] px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#FF5615]/25 hover:bg-[#E84A0E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615] focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {placing ? "Placing order…" : "Place order"}
        </button>
      </div>
    </div>
  );
}
