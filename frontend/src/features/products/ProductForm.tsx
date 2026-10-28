import { useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { useForm } from "react-hook-form";
import type { FieldError, UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "../../components/ui";
import { ApiError } from "../../lib/http";
import { useCategories, useDeleteProductImage, useSaveProduct, useSuppliers, useUploadProductImage } from "./hooks";
import ImageUploadField from "./ImageUploadField";
import { PRODUCT_FIELDS, productSchema, toDefaults } from "./schema";
import type { ProductField, ProductFormValues } from "./schema";
import type { Option, Product } from "./types";

const inputClass = (invalid: boolean) =>
  `h-10 w-full rounded-lg border bg-white px-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 ${
    invalid
      ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/20"
      : "border-[#E5E7EB] focus:border-[#FF5615] focus:ring-[#FF5615]/25"
  }`;

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: FieldError;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-[#374151]">
        {label} {required && <span className="text-[#FF5615]">*</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-[#DC2626]">
          {error.message}
        </p>
      )}
    </div>
  );
}

type TextFieldProps = {
  id: string;
  label: string;
  reg: UseFormRegisterReturn;
  error?: FieldError;
  required?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "name" | "onChange" | "onBlur" | "ref">;

function TextField({ id, label, reg, error, required, ...rest }: TextFieldProps) {
  return (
    <Field id={id} label={label} required={required} error={error}>
      <input
        id={id}
        {...reg}
        {...rest}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClass(!!error)}
      />
    </Field>
  );
}

type OptionsQuery = { isPending: boolean; isError: boolean; data?: Option[]; refetch: () => unknown };

function SelectField({
  id,
  label,
  placeholder,
  reg,
  error,
  query,
  noun,
  required = true,
}: {
  id: string;
  label: string;
  placeholder: string;
  reg: UseFormRegisterReturn;
  error?: FieldError;
  query: OptionsQuery;
  noun: string;
  required?: boolean;
}) {
  return (
    <Field id={id} label={label} required={required} error={error}>
      {query.isPending ? (
        <div className={`${inputClass(false)} flex items-center bg-[#F9FAFB] text-[#9CA3AF]`}>Loading {noun}…</div>
      ) : query.isError ? (
        <div className={`${inputClass(true)} flex items-center justify-between bg-white`}>
          <span className="text-[#DC2626]">Couldn’t load {noun}</span>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="text-xs font-semibold text-[#FF5615] hover:underline"
          >
            Retry
          </button>
        </div>
      ) : (
        <select
          id={id}
          {...reg}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={inputClass(!!error)}
        >
          <option value="">{placeholder}</option>
          {query.data?.map((o) => (
            <option key={o.id} value={String(o.id)}>
              {o.name}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export default function ProductForm({
  product,
  onSaved,
  onCancel,
}: {
  product?: Product;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const categories = useCategories();
  const suppliers = useSuppliers();
  const save = useSaveProduct();
  const uploadImage = useUploadProductImage();
  const deleteImage = useDeleteProductImage();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const busy = save.isPending || uploadImage.isPending || deleteImage.isPending;

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: toDefaults(product),
    mode: "onTouched",
  });

  /** Dropping a newly picked file clears it; dropping the saved image marks it for DELETE on save. */
  const handleImageRemove = () => {
    if (imageFile) setImageFile(null);
    else if (product?.imageUrl) setImageRemoved(true);
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    let saved: Product;
    try {
      saved = await save.mutateAsync({ id: product?.id, values });
    } catch (err) {
      if (err instanceof ApiError) {
        // Put each server message under its own field (e.g. duplicate SKU -> SKU field).
        const fields = PRODUCT_FIELDS.filter((f) => err.fieldErrors[f]);
        fields.forEach((f: ProductField) => setError(f, { type: "server", message: err.fieldErrors[f] }));
        if (fields.length > 0) setFocus(fields[0]);
        else setFormError(err.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
      return;
    }

    // The product exists from here on: an image failure must not undo it.
    const id = product?.id ?? saved.id;
    try {
      if (imageFile) {
        await uploadImage.mutateAsync({ id, file: imageFile });
      } else if (imageRemoved && product?.imageUrl) {
        await deleteImage.mutateAsync(id);
      }
    } catch (err) {
      const reason = err instanceof ApiError ? err.message : "Please try again.";
      toast.error(
        imageFile
          ? "Product saved, but the image could not be uploaded."
          : "Product saved, but the image could not be removed.",
        `${reason} Edit the product to try again.`,
      );
    }

    onSaved();
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      {formError && (
        <div role="alert" className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">
          {formError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="pf-sku" label="SKU" required reg={register("sku")} error={errors.sku} placeholder="e.g. SKU-1842" autoComplete="off" />
        <TextField id="pf-barcode" label="Barcode" reg={register("barcode")} error={errors.barcode} placeholder="Optional" autoComplete="off" />

        <div className="sm:col-span-2">
          <TextField id="pf-name" label="Name" required reg={register("name")} error={errors.name} placeholder="Product name" />
        </div>

        <TextField id="pf-price" label="Price" required reg={register("price")} error={errors.price} inputMode="decimal" placeholder="0.00" />
        <TextField id="pf-cost" label="Cost price" reg={register("costPrice")} error={errors.costPrice} inputMode="decimal" placeholder="Optional" />

        <SelectField id="pf-category" label="Category" placeholder="Select a category" noun="categories" reg={register("categoryId")} error={errors.categoryId} query={categories} />
        <SelectField id="pf-supplier" label="Supplier" placeholder="No supplier" noun="suppliers" reg={register("supplierId")} error={errors.supplierId} query={suppliers} required={false} />

        <TextField id="pf-min" label="Min stock" required reg={register("minStock")} error={errors.minStock} inputMode="numeric" placeholder="0" />
        <div className="sm:col-span-2">
          <ImageUploadField
            currentUrl={product?.imageUrl ?? null}
            file={imageFile}
            removed={imageRemoved}
            onFileSelect={(file) => {
              setImageFile(file);
              setImageRemoved(false);
            }}
            onRemove={handleImageRemove}
            disabled={save.isPending}
            loading={uploadImage.isPending || deleteImage.isPending}
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615] disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-[#FF5615] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#FF5615]/25 hover:bg-[#E84A0E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615] focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {busy ? "Saving…" : product ? "Save changes" : "Add product"}
        </button>
      </div>
    </form>
  );
}
