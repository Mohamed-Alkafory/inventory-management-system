import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "../../lib/http";
import { useAdjustStock } from "./hooks";
import { adjustSchema, parseChange } from "./schema";
import type { AdjustFormValues } from "./schema";
import type { InventoryItem } from "./types";

/** API field name → form field name. Add your server's names here if they differ. */
const ALIASES: Record<string, keyof AdjustFormValues> = {
  change: "change",
  quantity: "change",
  delta: "change",
  adjustment: "change",
  amount: "change",
  reason: "reason",
};

const fieldClass = (invalid: boolean) =>
  `w-full rounded-lg border bg-white px-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 ${
    invalid ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/20" : "border-[#E5E7EB] focus:border-[#FF5615] focus:ring-[#FF5615]/25"
  }`;

export default function AdjustStockForm({
  item,
  onSaved,
  onCancel,
}: {
  item: InventoryItem;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const adjust = useAdjustStock();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    control,
    formState: { errors },
  } = useForm<AdjustFormValues>({
    resolver: zodResolver(adjustSchema),
    defaultValues: { change: "", reason: "" },
    mode: "onTouched",
  });

  const changeValue = useWatch({ control, name: "change" });
  const change = parseChange(changeValue ?? "");
  const preview = change === null ? null : item.currentStock + change;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await adjust.mutateAsync({ productId: item.id, change: Number(values.change), reason: values.reason });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        // Show the server's message under the field it belongs to (e.g. "below zero" → Change).
        const mapped: Partial<Record<keyof AdjustFormValues, string>> = {};
        for (const [k, msg] of Object.entries(err.fieldErrors)) {
          const f = ALIASES[k];
          if (f && !mapped[f]) mapped[f] = msg;
        }
        const fields = (["change", "reason"] as const).filter((f) => mapped[f]);
        fields.forEach((f) => setError(f, { type: "server", message: mapped[f] }));
        if (fields.length > 0) setFocus(fields[0]);
        else setFormError(err.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="mb-5 rounded-lg bg-[#F8F8F8] px-4 py-3 text-sm">
        <p className="font-semibold text-[#111827]">{item.name}</p>
        <p className="mt-0.5 text-xs text-[#6B7280]">
          {item.sku} · Current stock: <span className="font-semibold text-[#111827]">{item.currentStock}</span>
        </p>
      </div>

      {formError && (
        <div role="alert" className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">
          {formError}
        </div>
      )}

      <label htmlFor="adj-change" className="mb-1.5 block text-xs font-semibold text-[#374151]">
        Change <span className="text-[#FF5615]">*</span>
      </label>
      <input
        id="adj-change"
        {...register("change")}
        autoFocus
        autoComplete="off"
        inputMode="numeric"
        placeholder="e.g. 10 to add, -3 to remove"
        aria-invalid={!!errors.change}
        aria-describedby={errors.change ? "adj-change-error" : "adj-change-hint"}
        className={`${fieldClass(!!errors.change)} h-10`}
      />
      {errors.change ? (
        <p id="adj-change-error" role="alert" className="mt-1 text-xs font-medium text-[#DC2626]">
          {errors.change.message}
        </p>
      ) : (
        <p id="adj-change-hint" className={`mt-1 text-xs ${preview !== null && preview < 0 ? "font-medium text-[#DC2626]" : "text-[#6B7280]"}`}>
          {preview === null ? "Use a negative number to remove stock." : `New stock will be ${preview}.`}
        </p>
      )}

      <label htmlFor="adj-reason" className="mb-1.5 mt-4 block text-xs font-semibold text-[#374151]">
        Reason <span className="text-[#FF5615]">*</span>
      </label>
      <textarea
        id="adj-reason"
        {...register("reason")}
        rows={3}
        placeholder="e.g. Supplier delivery, damaged goods, inventory count…"
        aria-invalid={!!errors.reason}
        aria-describedby={errors.reason ? "adj-reason-error" : undefined}
        className={`${fieldClass(!!errors.reason)} resize-none py-2`}
      />
      {errors.reason && (
        <p id="adj-reason-error" role="alert" className="mt-1 text-xs font-medium text-[#DC2626]">
          {errors.reason.message}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={adjust.isPending}
          className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615] disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={adjust.isPending}
          className="rounded-lg bg-[#FF5615] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#FF5615]/25 hover:bg-[#E84A0E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615] focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {adjust.isPending ? "Saving…" : "Adjust stock"}
        </button>
      </div>
    </form>
  );
}
