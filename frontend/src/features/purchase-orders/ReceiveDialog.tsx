import { useState } from "react";
import { ApiError } from "../../lib/http";
import { Button, Modal, useToast } from "../../components/ui";
import { usePurchaseOrder, useReceivePo } from "./hooks";

/**
 * Receive stock for a purchase order (full or partial). Each line shows
 * what has already arrived; the quantity is clamped to what is still
 * missing ("block receiving more than remaining", both here and again in
 * the backend with 409). Empty quantities are simply not sent. The parent
 * mounts this dialog only while it is open, so local state starts fresh.
 */
export default function ReceiveDialog({ poId, onClose }: { poId: string; onClose: () => void }) {
  const toast = useToast();
  const receive = useReceivePo();
  const detail = usePurchaseOrder(poId);

  const [qty, setQty] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  // A missing entry simply defaults to 0 — "receive all" is one click away.
  const po = detail.data;
  const lines = po?.lines ?? [];
  const remainingOf = (productId: string) => {
    const line = lines.find((l) => l.productId === productId);
    return line ? line.quantityOrdered - line.quantityReceived : 0;
  };

  const setLine = (productId: string, value: number) => {
    setQty((current) => ({ ...current, [productId]: value }));
    setError(null);
  };

  const receiveAll = () =>
    setQty(Object.fromEntries(lines.map((l) => [l.productId, Math.max(0, l.quantityOrdered - l.quantityReceived)])));

  const selected = lines
    .map((l) => ({ productId: l.productId, quantity: Math.floor(qty[l.productId] ?? 0) }))
    .filter((l) => l.quantity > 0);

  const invalidLines = lines.filter((l) => {
    const value = qty[l.productId] ?? 0;
    return value < 0 || !Number.isInteger(value) || value > remainingOf(l.productId);
  });

  // A fully received order cannot take more stock from this dialog.
  const anythingLeft = lines.some((l) => remainingOf(l.productId) > 0);
  const saving = receive.isPending;
  const close = () => {
    if (!saving) onClose();
  };

  const submit = async () => {
    if (!po || selected.length === 0) return;
    setError(null);
    try {
      await receive.mutateAsync({ id: po.id, items: selected });
      toast.success("Stock received", `${selected.length} line${selected.length > 1 ? "s" : ""} brought into stock for ${po.number}.`);
      onClose();
    } catch (err) {
      // Server still enforces the remaining limit — surface its message (409 etc.).
      if (err instanceof ApiError) setError(err.serverMessage ?? err.message);
      else if (err instanceof Error) setError(err.message);
    }
  };

  return (
    <Modal
      open
      onClose={close}
      title={po ? `Receive stock — ${po.number}` : "Receive stock"}
      description={po ? "Enter the quantity that physically arrived on each line. Partial receiving is fine; the PO closes itself when everything is in." : "Loading order…"}
      size="lg"
      dismissible={!saving}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={receiveAll} disabled={saving || !anythingLeft}>
            Receive all remaining
          </Button>
          <Button onClick={() => void submit()} loading={saving} disabled={selected.length === 0 || invalidLines.length > 0}>
            Receive {selected.length || ""}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        noValidate
      >
        {error && (
          <div role="alert" className="rounded-control border border-danger-600/20 bg-danger-50 px-3 py-2 text-sm text-danger-700">
            {error}
          </div>
        )}

        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-[#F8F8F8] text-xs font-semibold text-[#6B7280]">
            <tr>
              <th className="rounded-l-lg px-3 py-2">Product</th>
              <th className="px-3 py-2 text-right">Ordered</th>
              <th className="px-3 py-2 text-right">Received</th>
              <th className="px-3 py-2 text-right">Remaining</th>
              <th className="rounded-r-lg px-3 py-2 text-right">Receive now</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {lines.map((l) => {
              const remaining = remainingOf(l.productId);
              const value = qty[l.productId] ?? 0;
              const over = !Number.isInteger(value) || value > remaining || value < 0;
              return (
                <tr key={l.productId}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-[#111827]">{l.name || "(product)"}</p>
                    <p className="text-xs text-[#6B7280]">{l.sku}</p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.quantityOrdered}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#6B7280]">{l.quantityReceived}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{remaining}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <input
                        type="number"
                        min={0}
                        max={remaining}
                        step={1}
                        value={value}
                        onChange={(e) => setLine(l.productId, e.target.valueAsNumber)}
                        aria-label={`Quantity to receive for ${l.name || l.sku}`}
                        aria-invalid={over}
                        disabled={remaining === 0}
                        placeholder="0"
                        className={`h-9 w-20 rounded-lg border bg-white px-2 text-right text-sm tabular-nums text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FF5615]/25 disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF] ${
                          over ? "border-[#DC2626]" : "border-[#E5E7EB]"
                        }`}
                      />
                      {remaining > 0 && (
                        <button
                          type="button"
                          onClick={() => setLine(l.productId, remaining)}
                          className="rounded-lg px-2 py-1 text-xs font-semibold text-[#FF5615] transition hover:bg-[#FFF3EC]"
                        >
                          All
                        </button>
                      )}
                    </div>
                    {over && (
                      <p className="mt-1 text-right text-xs font-medium text-danger-600">
                        {value > remaining ? "More than remaining" : "Invalid quantity"}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!anythingLeft && (
          <p className="text-sm font-medium text-success-700">Everything ordered has been received.</p>
        )}
        {invalidLines.length === 0 && selected.length > 0 && (
          <p className="text-sm text-[#6B7280]">
            Receiving {selected.length} line{selected.length > 1 ? "s" : ""} — stock and stock movements update immediately.
          </p>
        )}
        <p className="text-xs text-[#6B7280]">Receiving never re-prices lines — costs stay exactly as they were placed.</p>
      </form>
    </Modal>
  );
}
