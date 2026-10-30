import { useParams } from "react-router-dom";
import OrderDetailsView from "../../features/orders/OrderDetailsView";

export default function OrderDetails() {
  const { id = "" } = useParams();
  return <OrderDetailsView id={id} scope="my" basePath="/dashboard/orders" />;
}
