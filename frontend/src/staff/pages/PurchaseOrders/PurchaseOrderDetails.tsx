import { useParams } from "react-router-dom";
import PurchaseOrderDetailsView from "../../../features/purchase-orders/PurchaseOrderDetailsView";
import { STAFF_PO_PATH } from "../../../features/purchase-orders/format";

/** Staff purchase-order detail: receive only. */
export default function StaffPurchaseOrderDetails() {
  const { id = "" } = useParams();
  return <PurchaseOrderDetailsView id={id} basePath={STAFF_PO_PATH} />;
}
