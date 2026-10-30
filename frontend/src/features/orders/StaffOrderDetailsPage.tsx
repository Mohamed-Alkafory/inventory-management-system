import { useParams } from "react-router-dom";
import OrderDetailsView from "./OrderDetailsView";
import { STAFF_ORDERS_PATH } from "./format";

/** Shared staff-scope order detail page. */
export default function StaffOrderDetailsPage({ basePath = STAFF_ORDERS_PATH }: { basePath?: string }) {
  const { id = "" } = useParams();
  return <OrderDetailsView id={id} scope="staff" basePath={basePath} />;
}
