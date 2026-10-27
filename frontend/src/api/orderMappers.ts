import type { CreateOrderInput, CreatedOrder } from "../types/orders";
import { ApiError } from "./errors";

/*
  POST /orders response → app types. Tolerant on purpose, like productMappers.
*/

type Dict = Record<string, unknown>;

const isDict = (v: unknown): v is Dict => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);
const num = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
};

/** Drop empty optional fields so the backend's IsOptional validators pass. */
export function toCreateOrderPayload(order: CreateOrderInput): CreateOrderInput {
  return {
    items: order.items,
    ...(text(order.customerName) ? { customerName: text(order.customerName) } : {}),
    ...(text(order.customerPhone) ? { customerPhone: text(order.customerPhone) } : {}),
    ...(text(order.notes) ? { notes: text(order.notes) } : {}),
  };
}

export function toCreatedOrder(data: unknown): CreatedOrder {
  if (!isDict(data)) throw new ApiError("Unexpected order response from the server.");

  const rawId = typeof data.id === "string" ? data.id : undefined;
  const orderNumber = text(data.orderNumber);
  if (!rawId || !orderNumber) throw new ApiError("Unexpected order response from the server.");

  return {
    id: rawId,
    orderNumber,
    totalAmount: num(data.totalAmount) ?? 0,
    items: Array.isArray(data.items)
      ? data.items.filter(isDict).map((item) => ({
          productId: text(item.productId) ?? "",
          productName: text(item.productName) ?? "",
          sku: text(item.sku) ?? "",
          quantity: num(item.quantity) ?? 0,
          unitPrice: num(item.unitPrice) ?? 0,
          lineTotal: num(item.lineTotal) ?? 0,
        }))
      : [],
  };
}
