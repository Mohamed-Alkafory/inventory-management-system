import StaffOrderDetailsPage from "../../../features/orders/StaffOrderDetailsPage";
import { SUPPORT_ORDERS_PATH } from "../../../features/orders/format";

/** /support/orders/:id — shared staff-scope details; SUPPORT sees notes only. */
export default function SupportOrderDetails() {
  return <StaffOrderDetailsPage basePath={SUPPORT_ORDERS_PATH} />;
}
