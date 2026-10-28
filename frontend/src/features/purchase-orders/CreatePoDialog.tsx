import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { ApiError } from "../../lib/http";
import { Button, Input, Modal, useToast } from "../../components/ui";
import { useSupplierPage } from "../products/suppliers/hooks";
import { useProducts } from "../../hooks/useProducts";
import { useCreatePo } from "./hooks";
import type { CreatePoInput } from "./types";

/** Data the low-stock "Reorder" action hands over pre-filled. */
export interface ReorderPrefill {
  productId: string;
  name: string;
  sku: string;
  /** How much to buy — reorder point minus what's left, at least 1. */
  quantity: number;
}

interface Line {
  /** Unique local key so rows stay stable while editing. */
  key: number;
  productId: string;
  quantity: number;
  unitCost: number;
}

let lineKey = 0;
const newLine = (productId = "", quantity = 1, unitCost = 0): Line => ({ key: ++lineKey, productId, quantity, unitCost });

const fieldClass = (invalid: boolean) =>
  `h-10 rounded-lg border bg-white px-3 py-0 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#FF5615]/25 ${
    invalid ? "border-[#DC2626]" : "border-[#E5E7EB]"
  }`;

const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });

/**
 * "New purchase order" dialog (ADMIN): supplier + one or more product
 * lines { quantity, unitCost }, optional expected date and notes. The
 * orderNumber and totals are computed server-side; the created PO starts
 * in DRAFT. The parent mounts this dialog only while it is open and may
 * pass a `prefill` line (inventory "Reorder"), so the form always starts
 * fresh without reset effects.
 */
export default function CreatePoDialog({ prefill, onClose }: { prefill?: ReorderPrefill | null; onClose: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const create = useCreatePo();

  const suppliers = useSupplierPage({ search: "", page: 1, pageSize: 100 });
  const products = useProducts({ search: "", category: "", status: "", sortBy: null, sortDir: "asc", page: 1, pageSize: 100 });

  // Prefill from the Reorder action (mount-time init — the parent remounts us per open).
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<Line[]>(() =>
    prefill ? [newLine(prefill.productId, prefill.quantity, 0)] : [newLine()],
  );
  const [expectedAt, setExpectedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const byId = new Map((products.data?.items ?? []).map((p) => [p.id, p]));
  const total = lines.reduce((sum, l) => sum + (l.quantity || 0) * (l.unitCost || 0), 0);
  const saving = create.isPending;

  const updateLine = (key: number, patch: Partial<Pick<Line, "productId" | "quantity" | "unitCost">>) =>
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const pickProduct = (key: number, productId: string) => {
    // Default the unit cost to the product's cost price (ADMIN sees it).
    const product = byId.get(productId);
    updateLine(key, { productId, ...(product?.costPrice !== undefined ? { unitCost: product.costPrice } : {}) });
  };

  const close = () => {
    if (!saving) onClose();
  };

  const valid =
    supplierId !== "" &&
    lines.length > 0 &&
    lines.every((l) => l.productId !== "" && Number.isInteger(l.quantity) && l.quantity >= 1 && l.unitCost >= 0);

  const submit = async () => {
    setFormError(null);
    const input: CreatePoInput = {
      supplierId,
      lines: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitCost: l.unitCost })),
      ...(expectedAt ? { expectedAt: new Date(`${expectedAt}T00:00:00`).toISOString() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    try {
      const created = await create.mutateAsync(input);
      toast.success(`Purchase order ${created.number} created`, "It starts as a draft — place the order to send it to the supplier.");
      onClose();
      navigate(`/admin/purchase-orders/${created.id}`);
    } catch (err) {
      if (err instanceof ApiError) setFormError(err.serverMessage ?? err.message);
      else if (err instanceof Error) setFormError(err.message);
    }
  };

  return (
    <Modal
      open
      onClose={close}
      title="New purchase order"
      description="Pick a supplier and the products to restock. The PO starts as a draft — no stock moves until you receive it."
      size="lg"
      dismissible={!saving}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={saving} disabled={!valid}>
            Create purchase order
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
        {formError && (
          <div role="alert" className="rounded-control border border-danger-600/20 bg-danger-50 px-3 py-2 text-sm text-danger-700">
            {formError}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="po-supplier" className="mb-1 block text-xs font-semibold text-[#374151]">
              Supplier *
            </label>
            <select
              id="po-supplier"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              aria-invalid={supplierId === ""}
              className={`${fieldClass(supplierId === "")} w-full`}
            >
              <option value="">Select a supplier…</option>
              {suppliers.data?.items
                .filter((s) => s.isActive)
                .map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label htmlFor="po-expected" className="mb-1 block text-xs font-semibold text-[#374151]">
              Expected date
            </label>
            <Input id="po-expected" type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#374151]">Products *</p>
          <div className="overflow-x-auto rounded-lg border border-[#E5E7EB]">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-[#F8F8F8] text-xs font-semibold text-[#6B7280]">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  <th className="w-24 px-3 py-2">Quantity</th>
                  <th className="w-28 px-3 py-2">Unit cost</th>
                  <th className="w-14 px-3 py-2">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {lines.map((l) => {
                  const dupCount = lines.filter((x) => x.productId !== "" && x.productId === l.productId).length;
                  const known = l.productId === "" || byId.has(l.productId);
                  return (
                    <tr key={l.key}>
                      <td className="px-3 py-2">
                        <select
                          value={l.productId}
                          onChange={(e) => pickProduct(l.key, e.target.value)}
                          aria-label="Product"
                          className={`${fieldClass(dupCount > 1)} w-full`}
                        >
                          <option value="">Select a product…</option>
                          {/* A prefilled product stays selectable while the products list loads. */}
                          {!known && prefill?.productId === l.productId && (
                            <option value={prefill.productId}>{prefill.name} ({prefill.sku})</option>
                          )}
                          {products.data?.items.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku})
                            </option>
                          ))}
                        </select>
                        {dupCount > 1 && <p className="mt-1 text-xs font-medium text-[#DC2626]">Product added twice</p>}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={l.quantity}
                          onChange={(e) => updateLine(l.key, { quantity: e.target.valueAsNumber })}
                          aria-label="Quantity"
                          className={`${fieldClass(!!l.quantity && (l.quantity < 1 || !Number.isInteger(l.quantity)))} w-full`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.unitCost}
                          onChange={(e) => updateLine(l.key, { unitCost: e.target.valueAsNumber })}
                          aria-label="Unit cost"
                          className={`${fieldClass(!!l.unitCost && l.unitCost < 0)} w-full`}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          aria-label="Remove line"
                          disabled={lines.length === 1}
                          onClick={() => setLines((current) => current.filter((x) => x.key !== l.key))}
                          className="rounded-lg p-2 text-[#6B7280] transition hover:bg-[#FEF2F2] hover:text-[#DC2626] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <Button variant="secondary" size="sm" leftIcon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setLines((c) => [...c, newLine()])}>
              Add product
            </Button>
            <p className="text-sm font-semibold text-[#111827]">
              Total: <span className="font-mono">{money.format(total)}</span>
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="po-notes" className="mb-1 block text-xs font-semibold text-[#374151]">
            Notes
          </label>
          <textarea
            id="po-notes"
            rows={2}
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Restock for November"
            className="w-full resize-none rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] focus:border-[#FF5615] focus:outline-none focus:ring-2 focus:ring-[#FF5615]/25"
          />
        </div>
      </form>
    </Modal>
  );
}
