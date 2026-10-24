import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { fieldClass } from "./field-styles";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
  /** Renders a disabled empty first option, e.g. "Select a category". */
  placeholder?: string;
  /** Applied to the wrapper (width, margin, ...). */
  wrapperClassName?: string;
};

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, placeholder, wrapperClassName, className, children, ...rest },
  ref,
) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={fieldClass(invalid, cn("appearance-none pr-9", className))}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
    </div>
  );
});

export default Select;
