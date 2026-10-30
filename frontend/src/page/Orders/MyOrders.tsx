import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "../../context/auth/useAuth";
import { USE_MOCK } from "../../features/orders/api";
import OrdersList from "../../features/orders/OrdersList";
import { useArea } from "../../routes/useArea";

/**
 * "My orders" — the signed-in customer's own orders (GET /orders/mine).
 * The shared OrdersList handles the status filter, pagination and the
 * customer-scoped cancel action.
 */
export default function MyOrders() {
  const { user } = useAuth();
  // Inside a dashboard shell the layout owns the page background and padding.
  const inArea = useArea() !== null;

  if (!user) return null;

  return (
    <div className={inArea ? undefined : "min-h-[calc(100vh_-_var(--header-h))] bg-surface-alt py-10 text-ink"}>
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <Link
          to="/dashboard/profile"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-primary-600"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Back to profile
        </Link>

        <h1 className="mt-3 text-3xl font-bold">My orders</h1>
        <p className="mt-1 text-sm text-muted">Orders you placed, with status filters and pagination.</p>
        {USE_MOCK && (
          <p className="mt-2 inline-block rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700">
            Demo data (mock API)
          </p>
        )}

        <div className="mt-6">
          <OrdersList scope="my" basePath="/dashboard/orders" />
        </div>
      </div>
    </div>
  );
}
