import { Link } from "react-router-dom";
import { Mail, ShoppingBag } from "lucide-react";
import { Card, CardBody } from "../../../components/ui/Card";
import { SUPPORT_MESSAGES_PATH } from "../../../features/contact/format";
import { useContactMessages } from "../../../features/contact/hooks";
import { useOrders } from "../../../features/orders/hooks";
import { SUPPORT_ORDERS_PATH } from "../../../features/orders/format";

/** One list call with limit 1: only `meta.total` is needed. */
const countQuery = { page: 1, pageSize: 1 };

function StatCard({
  label,
  value,
  hint,
  to,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | null;
  hint: string;
  to: string;
  icon: typeof Mail;
  tone: string;
}) {
  return (
    <Link to={to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615]">
      <Card className="h-full transition hover:shadow-md">
        <CardBody className="flex items-start gap-3 p-4">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">{label}</p>
            <p className="mt-0.5 text-2xl font-extrabold text-[#111827]">{value ?? "—"}</p>
            <p className="mt-0.5 text-xs text-[#6B7280]">{hint}</p>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}

/**
 * Support landing page. Counts come from the two list endpoints SUPPORT may
 * read (contact messages and orders) with `limit=1`; no dashboard, users,
 * stock or audit endpoints are called.
 */
export default function SupportDashboard() {
  const newMessages = useContactMessages({
    status: "NEW",
    assignedToId: "",
    search: "",
    ...countQuery,
  });
  const pendingOrders = useOrders({
    search: "",
    status: "PENDING",
    from: "",
    to: "",
    ...countQuery,
  });

  return (
    <div className="text-ink">
      <h1 className="text-2xl font-extrabold text-[#111827]">Support dashboard</h1>
      <p className="mt-1 text-sm text-[#6B7280]">Customer conversations and orders that need attention</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="New messages"
          value={newMessages.data?.total ?? null}
          hint="Waiting for a first reply"
          to={SUPPORT_MESSAGES_PATH}
          icon={Mail}
          tone="bg-[#EEF2FF] text-[#4F46E5]"
        />
        <StatCard
          label="Pending orders"
          value={pendingOrders.data?.total ?? null}
          hint="Still waiting to be confirmed"
          to={SUPPORT_ORDERS_PATH}
          icon={ShoppingBag}
          tone="bg-[#FFF1EB] text-[#FF5615]"
        />
      </div>

      {newMessages.isError && (
        <p role="alert" className="mt-4 text-sm text-[#DC2626]">
          Couldn’t load the message count.
        </p>
      )}
      {pendingOrders.isError && (
        <p role="alert" className="mt-4 text-sm text-[#DC2626]">
          Couldn’t load the order count.
        </p>
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to={SUPPORT_MESSAGES_PATH}
          className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm font-semibold text-[#111827] transition hover:border-[#FF5615] hover:text-[#FF5615]"
        >
          Open the inbox →
        </Link>
        <Link
          to={SUPPORT_ORDERS_PATH}
          className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm font-semibold text-[#111827] transition hover:border-[#FF5615] hover:text-[#FF5615]"
        >
          Browse orders →
        </Link>
      </div>
    </div>
  );
}
