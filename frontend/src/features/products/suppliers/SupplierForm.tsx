import { useState } from "react";
import type { InputHTMLAttributes } from "react";
import { useForm } from "react-hook-form";
import type { FieldError, UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "../../../lib/http";
import { useSaveSupplier } from "./hooks";
import { SUPPLIER_FIELDS, supplierSchema } from "./schema";
import type { SupplierField, SupplierFormValues } from "./schema";
import type { Supplier } from "./types";

/** API field name → form field name. Add your server's names here if they differ. */
const ALIASES: Record<string, SupplierField> = {
  name: "name",
  contactPerson: "contactPerson",
  contact_person: "contactPerson",
  contact: "contactPerson",
  email: "email",
  phone: "phone",
};

function mapServerErrors(fieldErrors: Record<string, string>): Partial<Record<SupplierField, string>> {
  const out: Partial<Record<SupplierField, string>> = {};
  for (const [k, msg] of Object.entries(fieldErrors)) {
    const f = ALIASES[k];
    if (f && !out[f]) out[f] = msg;
  }
  return out;
}

type TextFieldProps = {
  id: string;
  label: string;
  reg: UseFormRegisterReturn;
  error?: FieldError;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "name" | "onChange" | "onBlur" | "ref">;

function TextField({ id, label, reg, error, ...rest }: TextFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-[#374151]">
        {label} <span className="text-[#FF5615]">*</span>
      </label>
      <input
        id={id}
        {...reg}
        {...rest}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`h-10 w-full rounded-lg border bg-white px-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 ${
          error
            ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/20"
            : "border-[#E5E7EB] focus:border-[#FF5615] focus:ring-[#FF5615]/25"
        }`}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-[#DC2626]">
          {error.message}
        </p>
      )}
    </div>
  );
}

export default function SupplierForm({
  supplier,
  onSaved,
  onCancel,
}: {
  supplier?: Supplier;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const save = useSaveSupplier();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: supplier?.name ?? "",
      contactPerson: supplier?.contactPerson ?? "",
      email: supplier?.email ?? "",
      phone: supplier?.phone ?? "",
    },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await save.mutateAsync({ id: supplier?.id, values });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        // Put each server message under its own field (e.g. duplicate email → Email field).
        const mapped = mapServerErrors(err.fieldErrors);
        const fields = SUPPLIER_FIELDS.filter((f) => mapped[f]);
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
      {formError && (
        <div role="alert" className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">
          {formError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextField id="sup-name" label="Name" reg={register("name")} error={errors.name} placeholder="e.g. Tech Global" autoFocus />
        </div>
        <TextField id="sup-contact" label="Contact person" reg={register("contactPerson")} error={errors.contactPerson} placeholder="e.g. Ahmed Rami" />
        <TextField id="sup-phone" label="Phone" reg={register("phone")} error={errors.phone} type="tel" inputMode="tel" placeholder="+20 100 123 4567" />
        <div className="sm:col-span-2">
          <TextField id="sup-email" label="Email" reg={register("email")} error={errors.email} type="email" inputMode="email" placeholder="name@company.com" autoComplete="off" />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={save.isPending}
          className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615] disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-lg bg-[#FF5615] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#FF5615]/25 hover:bg-[#E84A0E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615] focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {save.isPending ? "Saving…" : supplier ? "Save changes" : "Add supplier"}
        </button>
      </div>
    </form>
  );
}
