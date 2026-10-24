import { useId } from "react";
import type { ReactNode } from "react";
import { cn } from "../../../lib/cn";

/** Props to spread onto Input / Select / Textarea so label, hint and error are wired up. */
export type FieldControlProps = {
  id: string;
  invalid: boolean;
  "aria-describedby"?: string;
};

export type FieldProps = {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
};

/** Label + control + hint + error message. No form-library dependency. */
export default function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="ml-0.5 text-danger-600" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children({ id, invalid: Boolean(error), "aria-describedby": describedBy })}

      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
}
