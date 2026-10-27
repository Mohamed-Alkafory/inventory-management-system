import { STATUS_LABEL } from "./status";
import type { StockStatus } from "./types";

const STYLE: Record<StockStatus, string> = {
  in_stock: "bg-[#DDF5EA] text-[#1F8F6B]",
  low_stock: "bg-[#FFEAB6] text-[#B7791F]",
  out_of_stock: "bg-[#FFD6D8] text-[#C53030]",
};

export default function StatusChip({ status }: { status: StockStatus }) {
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}
