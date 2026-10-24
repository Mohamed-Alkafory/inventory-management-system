import { AlertTriangle } from "lucide-react";
import { cn } from "../../lib/cn";
import Button from "./Button";

type Props = {
  title?: string;
  message?: string;
  /** When provided a "Try again" button is shown. */
  onRetry?: () => void;
  className?: string;
};

export default function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className,
}: Props) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-danger-50 text-danger-600">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {message && <p className="max-w-sm text-sm text-muted">{message}</p>}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
