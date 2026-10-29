import { useParams } from "react-router-dom";
import PurchaseOrderDetailsView from "../../../features/purchase-orders/PurchaseOrderDetailsView";

export default function PurchaseOrderDetails() {
  const { id = "" } = useParams();
  return <PurchaseOrderDetailsView id={id} />;
}
