import type { ReactNode } from "react";
import { Card, CardBody, CardHeader, ErrorState, Skeleton } from "../../components/ui";
import { errorMessage } from "../../lib/errorMessage";

interface QueryState {
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => unknown;
  error?: unknown;
}

/** A dashboard card with its own loading, error-with-retry and refreshing states. */
export default function WidgetCard({
  title,
  description,
  query,
  action,
  className = "",
  children,
}: {
  title: string;
  description?: string;
  query: QueryState;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader title={title} description={description} action={action} />
      <CardBody>
        {query.isPending ? (
          <div role="status" aria-label={`Loading ${title}`} className="space-y-3">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        ) : query.isError ? (
          <ErrorState
            title={`Couldn't load ${title.toLowerCase()}`}
            message={errorMessage(query.error, "Check that the backend is running, then try again.")}
            onRetry={() => void query.refetch()}
            className="py-8"
          />
        ) : (
          <div className={`transition-opacity ${query.isFetching ? "opacity-60" : ""}`} aria-busy={query.isFetching}>
            {children}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
