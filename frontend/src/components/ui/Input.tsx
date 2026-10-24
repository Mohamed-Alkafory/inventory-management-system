import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { fieldClass } from "./field-styles";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={fieldClass(invalid, className)}
      {...rest}
    />
  );
});

export default Input;
