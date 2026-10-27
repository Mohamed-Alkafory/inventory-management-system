import { delay } from "../mockSwitch";
import type { CreateOrderInput, CreatedOrder } from "../../types/orders";

/**
 * In-memory stand-in for POST /orders while the backend is not running
 * (set VITE_USE_MOCK=true). Fabricates a plausible success response.
 */
const mockOrdersApi = {
  async create(order: CreateOrderInput): Promise<CreatedOrder> {
    await delay();
    const sequence = Math.floor(Math.random() * 9000) + 1000;
    return {
      id: `mock-order-${sequence}`,
      orderNumber: `ORD-${String(sequence).padStart(4, "0")}`,
      totalAmount: order.items.length * 100,
      items: order.items.map((item) => ({
        productId: item.productId,
        productName: "Mock product",
        sku: "MOCK-SKU",
        quantity: item.quantity,
        unitPrice: 100,
        lineTotal: item.quantity * 100,
      })),
    };
  },
};

export default mockOrdersApi;
