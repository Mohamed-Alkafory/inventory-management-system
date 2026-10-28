import Badge, { type BadgeTone } from "../../components/ui/Badge";
import { PO_STATUS_LABEL } from "./status";
import type { PoStatus } from "./types";

const STATUS_TONE: Record<PoStatus, BadgeTone> = {
  draft: "neutral",
  ordered: "info",
  partially_received: "warning",
  received: "success",
  cancelled: "danger",
};

/** Colour + label for every PO status — one place, like orders/StatusBadge. */
export default function PoStatusBadge({ status }: { status: PoStatus }) {
  return <Badge tone={STATUS_TONE[status]} dot>{PO_STATUS_LABEL[status]}</Badge>;
}
