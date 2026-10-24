import { cn } from "../../lib/cn";

type Props = {
  className?: string;
  /** Screen-reader text. When set the spinner is announced as a status. */
  label?: string;
};

export default function Spinner({ className, label }: Props) {
  return (
    <span role={label ? "status" : undefined} className={cn("inline-flex", className)}>
      <svg
        className="size-4 animate-spin motion-reduce:animate-none"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
