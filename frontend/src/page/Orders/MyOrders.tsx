import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "../../context/auth/useAuth";
import { USE_MOCK } from "../../features/orders/api";
import OrdersList from "../../features/orders/OrdersList";

/**
 * "My orders" — an orders list scoped to the signed-in user (createdById).
 * Reached from the profile page; the shared OrdersList handles search,
 * filters, pagination and confirm/cancel actions the same way the admin
 * list does.
 */
export default function MyOrders() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="min-h-[calc(100vh-128px)] bg-surface-alt py-10 text-ink">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <Link
          to="/profile"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-primary-600"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Back to profile
        </Link>

        <h1 className="mt-3 text-3xl font-bold">My orders</h1>
        <p className="mt-1 text-sm text-muted">Orders you created, with search, filters and pagination.</p>
        {USE_MOCK && (
          <p className="mt-2 inline-block rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700">
            Demo data (mock API)
          </p>
        )}

        <div className="mt-6">
          <OrdersList createdById={user.id} />
        </div>
      </div>
    </div>
  );
}
