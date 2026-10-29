import { STATUS_LABEL } from "./status";
import type { OrderStatus } from "./types";

const STYLE: Record<OrderStatus, string> = {
  pending: "bg-[#FFEAB6] text-[#B7791F]",
  processing: "bg-[#FFE4D6] text-[#D9480F]",
  shipped: "bg-[#DBEAFE] text-[#1D4ED8]",
  delivered: "bg-[#DDF5EA] text-[#1F8F6B]",
  cancelled: "bg-[#FFD6D8] text-[#C53030]",
};

export default function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}
