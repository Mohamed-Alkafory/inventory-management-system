import StaffOrdersPage from "../../../features/orders/StaffOrdersPage";
import { SUPPORT_ORDERS_PATH } from "../../../features/orders/format";

/** /support/orders — the shared staff-scope list without the staff till action. */
export default function SupportOrders() {
  return <StaffOrdersPage basePath={SUPPORT_ORDERS_PATH} showNewOrder={false} />;
}
