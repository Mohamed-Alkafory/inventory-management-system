import Badge from "./Badge";
import type { BadgeTone } from "./Badge";

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";
export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";
export type Status = StockStatus | OrderStatus;

/** One place that decides how every status looks. Add new statuses here. */
const STATUS_CONFIG: Record<Status, { label: string; tone: BadgeTone }> = {
  in_stock: { label: "In Stock", tone: "success" },
  low_stock: { label: "Low Stock", tone: "warning" },
  out_of_stock: { label: "Out of Stock", tone: "danger" },
  pending: { label: "Pending", tone: "warning" },
  processing: { label: "Processing", tone: "info" },
  shipped: { label: "Shipped", tone: "primary" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

type Props = {
  status: Status;
  className?: string;
};

export default function StatusBadge({ status, className }: Props) {
  const { label, tone } = STATUS_CONFIG[status];
  return (
    <Badge tone={tone} dot className={className}>
      {label}
    </Badge>
  );
}
