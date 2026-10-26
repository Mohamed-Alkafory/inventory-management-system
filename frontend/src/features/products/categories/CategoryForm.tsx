import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "../../../lib/http";
import { useSaveCategory } from "./hooks";
import { categorySchema } from "./schema";
import type { CategoryFormValues } from "./schema";
import type { Category } from "./types";

export default function CategoryForm({
  category,
  onSaved,
  onCancel,
}: {
  category?: Category;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const save = useSaveCategory();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: category?.name ?? "" },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await save.mutateAsync({ id: category?.id, values });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.name) {
        setError("name", { type: "server", message: err.fieldErrors.name }); // e.g. duplicate name
        setFocus("name");
      } else if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    }
  });

  const invalid = !!errors.name;

  return (
    <form onSubmit={onSubmit} noValidate>
      {formError && (
        <div role="alert" className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">
          {formError}
        </div>
      )}

      <label htmlFor="cat-name" className="mb-1.5 block text-xs font-semibold text-[#374151]">
        Name <span className="text-[#FF5615]">*</span>
      </label>
      <input
        id="cat-name"
        {...register("name")}
        autoFocus
        autoComplete="off"
        placeholder="e.g. Electronics"
        aria-invalid={invalid}
        aria-describedby={invalid ? "cat-name-error" : undefined}
        className={`h-10 w-full rounded-lg border bg-white px-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 ${
          invalid
            ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/20"
            : "border-[#E5E7EB] focus:border-[#FF5615] focus:ring-[#FF5615]/25"
        }`}
      />
      {errors.name && (
        <p id="cat-name-error" role="alert" className="mt-1 text-xs font-medium text-[#DC2626]">
          {errors.name.message}
        </p>
      )}

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
          {save.isPending ? "Saving…" : category ? "Save changes" : "Add category"}
        </button>
      </div>
    </form>
  );
}
