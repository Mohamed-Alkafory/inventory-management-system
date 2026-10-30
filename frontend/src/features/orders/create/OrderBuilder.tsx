import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle } from "lucide-react";
import OrderItems from "./OrderItems";
import ProductPicker from "./ProductPicker";
import { validateLines } from "./lines";
import { customerSchema } from "./schema";
import type { CustomerFormValues } from "./schema";
import type { DraftLine, Id, PickerProduct, StockFailure } from "./types";

const fieldClass = (invalid: boolean) =>
  `w-full rounded-lg border bg-white px-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 ${
    invalid ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/20" : "border-[#E5E7EB] focus:border-[#FF5615] focus:ring-[#FF5615]/25"
  }`;

export default function OrderBuilder({
  lines,
  customer,
  failures,
  banner,
  serverErrors,
  onAdd,
  onFresh,
  onQuantity,
  onRemove,
  onReview,
}: {
  lines: DraftLine[];
  customer: CustomerFormValues;
  failures: StockFailure[];
  banner: string | null;
  serverErrors: Partial<Record<keyof CustomerFormValues, string>>;
  onAdd: (p: PickerProduct) => void;
  onFresh: (products: PickerProduct[]) => void;
  onQuantity: (id: Id, quantity: number) => void;
  onRemove: (id: Id) => void;
  onReview: (customer: CustomerFormValues) => void;
}) {
  const [itemsError, setItemsError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<CustomerFormValues>({ resolver: zodResolver(customerSchema), defaultValues: customer, mode: "onTouched" });

  useEffect(() => {
    // Intentionally no-op to satisfy lint; items error is set on submit/validation
    void lines;
  }, [lines]);

  // Server-side validation messages (e.g. a phone number the API rejected) land under their field.
  useEffect(() => {
    (Object.entries(serverErrors) as Array<[keyof CustomerFormValues, string]>).forEach(([f, message]) => setError(f, { type: "server", message }));
  }, [serverErrors, setError]);

  const onSubmit = handleSubmit(
    (values) => {
      const problem = validateLines(lines);
      if (problem) return setItemsError(problem);
      onReview(values);
    },
    () => setItemsError(validateLines(lines)), // customer fields invalid → still say what's wrong with the items
  );

  const notesValue = useWatch({ control, name: "notes" });
  const notesLength = (notesValue ?? "").length;

  return (
    <div>
      {banner && (
        <div role="alert" className="mb-5 flex gap-3 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3 text-sm text-[#92400E]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">The order wasn’t placed.</p>
            <p>{banner}</p>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <ProductPicker lines={lines} onAdd={onAdd} onFresh={onFresh} />
          <OrderItems lines={lines} failures={failures} error={itemsError} onQuantity={onQuantity} onRemove={onRemove} />
        </div>

        <form onSubmit={onSubmit} noValidate aria-label="Customer details" className="h-fit space-y-4 rounded-2xl border border-[#E5E7EB] bg-white p-5 lg:col-span-2">
          <h2 className="text-base font-bold text-[#111827]">Customer</h2>

          <div>
            <label htmlFor="cust-name" className="mb-1.5 block text-xs font-semibold text-[#374151]">
              Customer name <span className="text-[#FF5615]">*</span>
            </label>
            <input id="cust-name" {...register("name")} autoComplete="off" placeholder="e.g. Ahmed Mohamed" aria-invalid={!!errors.name} aria-describedby={errors.name ? "cust-name-error" : undefined} className={`${fieldClass(!!errors.name)} h-10`} />
            {errors.name && (
              <p id="cust-name-error" role="alert" className="mt-1 text-xs font-medium text-[#DC2626]">
                {errors.name.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="cust-phone" className="mb-1.5 block text-xs font-semibold text-[#374151]">
              Phone <span className="text-[#FF5615]">*</span>
            </label>
            <input id="cust-phone" {...register("phone")} type="tel" inputMode="tel" autoComplete="off" placeholder="+20 100 123 4567" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "cust-phone-error" : undefined} className={`${fieldClass(!!errors.phone)} h-10`} />
            {errors.phone && (
              <p id="cust-phone-error" role="alert" className="mt-1 text-xs font-medium text-[#DC2626]">
                {errors.phone.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="cust-notes" className="mb-1.5 block text-xs font-semibold text-[#374151]">
              Notes
            </label>
            <textarea id="cust-notes" {...register("notes")} rows={4} placeholder="Delivery instructions, gift message…" aria-invalid={!!errors.notes} aria-describedby={errors.notes ? "cust-notes-error" : undefined} className={`${fieldClass(!!errors.notes)} resize-none py-2`} />
            <div className="mt-1 flex justify-between text-xs">
              <span id="cust-notes-error" role={errors.notes ? "alert" : undefined} className="font-medium text-[#DC2626]">
                {errors.notes?.message}
              </span>
              <span className="text-[#9CA3AF]">{notesLength}/500</span>
            </div>
          </div>

          <button
            type="submit"
            className="h-11 w-full rounded-lg bg-[#FF5615] text-sm font-semibold text-white shadow-md shadow-[#FF5615]/25 hover:bg-[#E84A0E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615] focus-visible:ring-offset-2"
          >
            Review order
          </button>
        </form>
      </div>
    </div>
  );
}
