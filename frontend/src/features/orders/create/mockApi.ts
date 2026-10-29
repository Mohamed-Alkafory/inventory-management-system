import { ApiError } from "../../../lib/http";
import { addMockOrder } from "../mockApi";
import type { CreateOrderInput, OrderBuilderApi, PickerProduct } from "./types";

/*
  In-memory stand-in for the backend, used until the real API is merged.
  Search, live stock, per-product 409 errors and "the new order appears in the Orders list"
  behave like the real one should. Data resets on page reload.
*/

let stockOf: Record<number, number> = { 1: 8, 2: 0, 3: 12, 4: 45, 5: 18, 6: 32, 7: 6, 8: 28, 9: 40, 10: 0, 11: 150, 12: 22 };
const CATALOG: Array<Omit<PickerProduct, "stock">> = [
  { id: 1, name: "Wireless Bluetooth Headphones", sku: "SKU-1842", price: 79.99 },
  { id: 2, name: "Organic Cotton T-Shirt (M)", sku: "SKU-2956", price: 24.99 },
  { id: 3, name: "Stainless Steel Water Bottle", sku: "SKU-3421", price: 19.99 },
  { id: 4, name: "Laptop Backpack", sku: "SKU-4187", price: 49.99 },
  { id: 5, name: "Smart Watch", sku: "SKU-5623", price: 199.99 },
  { id: 6, name: "Running Shoes", sku: "SKU-6732", price: 69.99 },
  { id: 7, name: "Coffee Maker", sku: "SKU-7841", price: 89.99 },
  { id: 8, name: "Desk Lamp", sku: "SKU-8120", price: 29.99 },
  { id: 9, name: "Yoga Mat", sku: "SKU-9001", price: 24.5 },
  { id: 10, name: "Ceramic Mug Set", sku: "SKU-9102", price: 34.0 },
  { id: 11, name: "Notebook Pack", sku: "SKU-9203", price: 12.99 },
  { id: 12, name: "Wireless Mouse", sku: "SKU-9304", price: 22.5 },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LATENCY = 300;

export const mockOrderBuilderApi: OrderBuilderApi = {
  async searchProducts(search) {
    await sleep(LATENCY / 2);
    const q = search.trim().toLowerCase();
    return CATALOG.filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .map((p) => ({ ...p, stock: stockOf[p.id as number] }))
      .sort((a, b) => Number((b.stock ?? 0) > 0) - Number((a.stock ?? 0) > 0) || a.name.localeCompare(b.name))
      .slice(0, 8);
  },

  async createOrder(input: CreateOrderInput) {
    await sleep(LATENCY);
    const fields: Record<string, string> = {};
    if (!input.customer.name.trim()) fields.name = "Customer name is required";
    if (!input.customer.phone.trim()) fields.phone = "Phone is required";
    if (Object.keys(fields).length) throw new ApiError(422, "Validation failed", { fieldErrors: fields, serverMessage: "Validation failed" });
    if (input.items.length === 0) throw new ApiError(422, "An order needs at least one item", { serverMessage: "An order needs at least one item" });

    // Check every line first, so the error can list ALL the products that failed.
    const failures = input.items.flatMap((i) => {
      const p = CATALOG.find((c) => c.id === i.productId);
      if (!p) return [];
      const available = stockOf[p.id as number];
      return i.quantity > available ? [{ productId: p.id, name: p.name, sku: p.sku, requested: i.quantity, available }] : [];
    });
    if (failures.length > 0) {
      const message = failures.length === 1 ? `Insufficient stock for ${failures[0].name}` : `Insufficient stock for ${failures.length} products`;
      throw new ApiError(409, message, { serverMessage: message, body: { message, errors: failures } });
    }

    const lines = input.items.map((i) => {
      const p = CATALOG.find((c) => c.id === i.productId)!;
      stockOf = { ...stockOf, [p.id as number]: stockOf[p.id as number] - i.quantity };
      return { name: p.name, sku: p.sku, quantity: i.quantity, unitPrice: p.price };
    });
    const created = addMockOrder({ customerName: input.customer.name.trim(), customerPhone: input.customer.phone.trim(), notes: input.notes.trim(), items: lines });
    return { id: created.id, number: created.number };
  },
};
