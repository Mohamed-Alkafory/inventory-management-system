import { useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { formatMoney } from "../format";
import { findFailure, lineIssue, lineTotal, orderTotal } from "./lines";
import type { DraftLine, Id, StockFailure } from "./types";

const stepBtn =
  "flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615] disabled:cursor-not-allowed disabled:opacity-40";

/** Lets the user clear the field and type a new number; only whole numbers ≥ 1 are committed. */
function QuantityInput({ value, label, invalid, onChange }: { value: number; label: string; invalid: boolean; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setText((t) => (Number(t) === value ? t : String(value)));
  }
  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseInt(e.target.value, 10);
        if (Number.isFinite(n) && n >= 1) onChange(n);
      }}
      onBlur={() => setText(String(value))}
      aria-label={label}
      aria-invalid={invalid}
      className={`h-8 w-14 rounded-md border bg-white text-center text-sm font-semibold text-[#111827] focus:outline-none focus:ring-2 ${
        invalid ? "border-[#DC2626] focus:ring-[#DC2626]/20" : "border-[#E5E7EB] focus:border-[#FF5615] focus:ring-[#FF5615]/25"
      }`}
    />
  );
}

export default function OrderItems({
  lines,
  failures,
  error,
  onQuantity,
  onRemove,
}: {
  lines: DraftLine[];
  failures: StockFailure[];
  error: string | null;
  onQuantity: (id: Id, quantity: number) => void;
  onRemove: (id: Id) => void;
}) {
  return (
    <section aria-labelledby="items-h" className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
      <h2 id="items-h" className="text-base font-bold text-[#111827]">
        Order items
      </h2>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">
          {error}
        </p>
      )}

      {lines.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#6B7280]">No products yet. Search above and press “Add”.</p>
      ) : (
        <ul className="mt-2 divide-y divide-[#F3F4F6]">
          {lines.map((l) => {
            const { product: p } = l;
            const issue = lineIssue(l, findFailure(l, failures));
            const atMax = p.stock !== null && l.quantity >= p.stock;
            return (
              <li key={p.id} className="py-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="min-w-40 flex-1">
                    <p className="text-sm font-semibold text-[#111827]">{p.name}</p>
                    <p className="text-xs text-[#6B7280]">
                      {p.sku} · {formatMoney(p.price)} each
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => onQuantity(p.id, l.quantity - 1)} disabled={l.quantity <= 1} aria-label={`Decrease quantity of ${p.name}`} className={stepBtn}>
                      <Minus className="h-4 w-4" />
                    </button>
                    <QuantityInput value={l.quantity} label={`Quantity of ${p.name}`} invalid={!!issue} onChange={(n) => onQuantity(p.id, n)} />
                    <button type="button" onClick={() => onQuantity(p.id, l.quantity + 1)} disabled={atMax} aria-label={`Increase quantity of ${p.name}`} className={stepBtn}>
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="w-24 text-right text-sm font-semibold text-[#111827]" aria-label={`Line total for ${p.name}`}>
                    {formatMoney(lineTotal(l))}
                  </p>
                  <button
                    type="button"
                    onClick={() => onRemove(p.id)}
                    aria-label={`Remove ${p.name}`}
                    className="rounded-md p-2 text-[#6B7280] hover:bg-[#FEF2F2] hover:text-[#DC2626] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {issue && (
                  <div role="alert" className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-[#B91C1C]">
                    <span>
                      <span className="font-bold">{p.name}:</span> {issue.message}
                    </span>
                    <button
                      type="button"
                      onClick={() => (issue.fixTo > 0 ? onQuantity(p.id, issue.fixTo) : onRemove(p.id))}
                      className="font-semibold text-[#FF5615] hover:underline"
                    >
                      {issue.fixTo > 0 ? `Use ${issue.fixTo}` : "Remove"}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex items-baseline justify-between border-t border-[#F3F4F6] pt-3">
        <div>
          <p className="text-sm font-semibold text-[#111827]">Estimated total</p>
          <p className="text-xs text-[#6B7280]">A preview only — the server calculates the final total.</p>
        </div>
        <p className="text-lg font-extrabold text-[#111827]" data-testid="estimated-total">
          {formatMoney(orderTotal(lines))}
        </p>
      </div>
    </section>
  );
}
