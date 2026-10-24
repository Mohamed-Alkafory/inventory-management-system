import type { ReactNode } from "react";
import { Controller } from "react-hook-form";
import type { Control, ControllerRenderProps, FieldPath, FieldValues } from "react-hook-form";
import Field from "./Field";
import type { FieldControlProps, FieldProps } from "./Field";

type FormFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> = Omit<
  FieldProps,
  "error" | "children"
> & {
  control: Control<TFieldValues>;
  name: TName;
  children: (args: { field: ControllerRenderProps<TFieldValues, TName>; aria: FieldControlProps }) => ReactNode;
};

/**
 * React Hook Form binding for Field. The error message comes from the form
 * state, so with `zodResolver` the Zod messages show up automatically.
 *
 * <FormField control={control} name="name" label="Product name" required>
 *   {({ field, aria }) => <Input {...field} {...aria} />}
 * </FormField>
 *
 * Give every field a default value in useForm so inputs stay controlled.
 */
export default function FormField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ control, name, children, ...fieldProps }: FormFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field {...fieldProps} error={fieldState.error?.message}>
          {(aria) => children({ field, aria })}
        </Field>
      )}
    />
  );
}
