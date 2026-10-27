import { ApiError } from "../../lib/http";
import { filterItems, filterMovements, paginate } from "./filters";
import { statusFor } from "./status";
import type { InventoryApi, InventoryItem, Option, StockMovement } from "./types";

/*
  In-memory stand-in for the backend, used until the real API is merged.
  Filters, pagination, movement history and the "stock can't go below zero" error
  behave like the real one should. Data resets on page reload.
*/

const CATEGORIES: Option[] = [
  { id: 1, name: "Electronics" },
  { id: 2, name: "Apparel" },
  { id: 3, name: "Accessories" },
  { id: 4, name: "Bags" },
  { id: 5, name: "Footwear" },
  { id: 6, name: "Home & Kitchen" },
  { id: 7, name: "Home & Office" },
  { id: 8, name: "Sports" },
  { id: 9, name: "Stationery" },
];
const catName = (id: number) => CATEGORIES.find((c) => c.id === id)!.name;

// [id, name, sku, categoryId, stock, reorderPoint]
const SEED: Array<[number, string, string, number, number, number]> = [
  [1, "Wireless Bluetooth Headphones", "SKU-1842", 1, 8, 20],
  [2, "Organic Cotton T-Shirt (M)", "SKU-2956", 2, 0, 50],
  [3, "Stainless Steel Water Bottle", "SKU-3421", 3, 12, 30],
  [4, "Laptop Backpack", "SKU-4187", 4, 45, 15],
  [5, "Smart Watch", "SKU-5623", 1, 18, 20],
  [6, "Running Shoes", "SKU-6732", 5, 32, 15],
  [7, "Coffee Maker", "SKU-7841", 6, 6, 15],
  [8, "Desk Lamp", "SKU-8120", 7, 28, 10],
  [9, "Yoga Mat", "SKU-9001", 8, 40, 15],
  [10, "Ceramic Mug Set", "SKU-9102", 6, 0, 12],
  [11, "Notebook Pack", "SKU-9203", 9, 150, 40],
  [12, "Wireless Mouse", "SKU-9304", 1, 22, 25],
];

let items: InventoryItem[] = SEED.map(([id, name, sku, cat, stock, reorderPoint]) => ({
  id, name, sku, imageUrl: null, categoryId: cat, categoryName: catName(cat),
  currentStock: stock, reorderPoint, status: statusFor(stock, reorderPoint),
}));

// History that adds up to each product's current stock: +S+30, −14, +10, −26.
const REASONS = ["Supplier delivery", "Customer order #ORD-1001", "Inventory count correction", "Damaged goods", "Customer return", "Customer order #ORD-1004"];
let moveId = 1;
const HOUR = 3_600_000;
const now = Date.now();
let movements: StockMovement[] = items.flatMap((it, n) =>
  [it.currentStock + 30, -14, 10, -26].map((change, k, arr) => {
    const running = arr.slice(0, k + 1).reduce((a, b) => a + b, 0);
    return {
      id: moveId++,
      productId: it.id,
      productName: it.name,
      sku: it.sku,
      change,
      stockAfter: running,
      reason: k === 0 ? "Initial stock" : REASONS[(n + k) % REASONS.length],
      createdAt: new Date(now - ((4 - k) * 70 + n * 5) * HOUR).toISOString(),
      createdBy: n % 2 ? "Sara Ali" : "Demo Admin",
    };
  }),
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LATENCY = 350;

export const mockInventoryApi: InventoryApi = {
  async list(p) {
    await sleep(LATENCY);
    const r = paginate(filterItems(items, p), p.page, p.pageSize);
    return { items: r.items.map((i) => ({ ...i })), total: r.total };
  },

  async movements(p) {
    await sleep(LATENCY);
    const r = paginate(filterMovements(movements, p), p.page, p.pageSize);
    return { items: r.items.map((m) => ({ ...m })), total: r.total };
  },

  async categories() {
    await sleep(150);
    return CATEGORIES.map((c) => ({ ...c }));
  },

  async adjust(productId, { change, reason }) {
    await sleep(LATENCY);
    const it = items.find((i) => i.id === productId);
    if (!it) throw new ApiError(404, "Product not found", { serverMessage: "Product not found" });
    if (!reason.trim()) throw new ApiError(422, "Reason is required", { fieldErrors: { reason: "Reason is required" }, serverMessage: "Reason is required" });
    if (!Number.isInteger(change) || change === 0) {
      const msg = "Change must be a non-zero whole number";
      throw new ApiError(422, msg, { fieldErrors: { change: msg }, serverMessage: msg });
    }
    const after = it.currentStock + change;
    if (after < 0) {
      const msg = `Stock can’t go below zero. Current stock is ${it.currentStock}.`;
      throw new ApiError(409, msg, { fieldErrors: { change: msg }, serverMessage: msg });
    }
    items = items.map((i) => (i.id === productId ? { ...i, currentStock: after, status: statusFor(after, i.reorderPoint) } : i));
    movements = [
      ...movements,
      { id: moveId++, productId, productName: it.name, sku: it.sku, change, stockAfter: after, reason: reason.trim(), createdAt: new Date().toISOString(), createdBy: "Demo Admin" },
    ];
  },
};
