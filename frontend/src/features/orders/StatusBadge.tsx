import { STATUS_LABEL, STATUS_TONE } from "./status";
import type { OrderStatus } from "./types";

export default function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}
