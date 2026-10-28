import { ORDER_ENDPOINTS } from "./endpoints";
import { http } from "./http";
import { toCreateOrderPayload, toCreatedOrder } from "./orderMappers";
import { withMock } from "./mockSwitch";
import mockOrdersApi from "./mock/ordersMock";
import type { CreateOrderInput, CreatedOrder } from "../types/orders";

export type OrdersApi = {
  /** Places a new order; the backend computes prices, totals and the order number. */
  create(order: CreateOrderInput): Promise<CreatedOrder>;
};

const realOrdersApi: OrdersApi = {
  async create(order) {
    const { data } = await http.post(ORDER_ENDPOINTS.create, toCreateOrderPayload(order));
    return toCreatedOrder(data);
  },
};

export const ordersApi = withMock(realOrdersApi, mockOrdersApi);
