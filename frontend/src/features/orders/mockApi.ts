import { ApiError } from "../../lib/http";
import { filterOrders, paginate } from "./filters";
import { ACTION_RULES, STATUS_LABEL, allowedActions } from "./status";
import type { Id, OrderDetails, OrdersApi, OrderStatus } from "./types";

/*
  In-memory stand-in for the backend, used until the real API is merged.
  Filters, pagination, details, status history, and 409 on invalid transitions
  behave like the real one should. Data resets on page reload.
*/

const CATALOG = {
  headphones: { name: "Wireless Bluetooth Headphones", sku: "SKU-1842", price: 79.99 },
  tshirt: { name: "Organic Cotton T-Shirt (M)", sku: "SKU-2956", price: 24.99 },
  bottle: { name: "Stainless Steel Water Bottle", sku: "SKU-3421", price: 19.99 },
  backpack: { name: "Laptop Backpack", sku: "SKU-4187", price: 49.99 },
  watch: { name: "Smart Watch", sku: "SKU-5623", price: 199.99 },
  shoes: { name: "Running Shoes", sku: "SKU-6732", price: 69.99 },
  coffee: { name: "Coffee Maker", sku: "SKU-7841", price: 89.99 },
  lamp: { name: "Desk Lamp", sku: "SKU-8120", price: 29.99 },
} as const;
type Key = keyof typeof CATALOG;

const r2 = (n: number) => Math.round(n * 100) / 100;
const HOUR = 3_600_000;
const now = Date.now();

// number, customer, email, createdBy, status, items, shipping, tax rate
const SEED: Array<[string, string, string, string, OrderStatus, Array<[Key, number]>, number, number]> = [
  ["ORD-1001", "Ahmed Mohamed", "ahmed.mohamed@example.com", "Sara Ali", "pending", [["headphones", 1], ["bottle", 2]], 9.99, 0],
  ["ORD-1002", "Sarah Ali", "sarah.ali@example.com", "Demo Admin", "processing", [["watch", 1], ["backpack", 1]], 0, 0.08],
  ["ORD-1003", "Omar Hassan", "omar.hassan@example.com", "Sara Ali", "shipped", [["tshirt", 2], ["shoes", 1]], 0, 0],
  ["ORD-1004", "Fatima Ahmed", "fatima.ahmed@example.com", "Demo Admin", "delivered", [["coffee", 1], ["lamp", 2]], 0, 0.08],
  ["ORD-1005", "Khaled Salem", "khaled.salem@example.com", "Demo Admin", "cancelled", [["bottle", 3], ["lamp", 1]], 9.99, 0],
  ["ORD-1006", "Layla Mostafa", "layla.mostafa@example.com", "Sara Ali", "processing", [["shoes", 2], ["tshirt", 1]], 0, 0],
  ["ORD-1007", "Youssef Khaled", "youssef.khaled@example.com", "Demo Admin", "pending", [["lamp", 2]], 9.99, 0],
  ["ORD-1008", "Nada Hassan", "nada.hassan@example.com", "Sara Ali", "delivered", [["headphones", 2]], 0, 0.08],
  ["ORD-1009", "Mona Fathy", "mona.fathy@example.com", "Demo Admin", "shipped", [["coffee", 2], ["bottle", 1]], 0, 0],
  ["ORD-1010", "Hany Samir", "hany.samir@example.com", "Sara Ali", "pending", [["backpack", 2], ["tshirt", 3]], 0, 0],
  ["ORD-1011", "Dina Adel", "dina.adel@example.com", "Demo Admin", "cancelled", [["watch", 1]], 0, 0],
  ["ORD-1012", "Tarek Wahba", "tarek.wahba@example.com", "Sara Ali", "delivered", [["shoes", 1], ["lamp", 1]], 9.99, 0],
];

function build(row: (typeof SEED)[number], idx: number): OrderDetails {
  const [number, customerName, customerEmail, createdBy, status, lines, shipping, taxRate] = row;
  const items = lines.map(([k, quantity]) => ({ productId: null, name: CATALOG[k].name, sku: CATALOG[k].sku, quantity, unitPrice: CATALOG[k].price }));
  const subtotal = r2(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
  const tax = r2(subtotal * taxRate);
  const created = now - (2 + idx * 30) * HOUR; // 30h apart → every order is on its own calendar day
  const iso = (h: number) => new Date(created + h * HOUR).toISOString();

  const history = [{ status: "pending" as OrderStatus, at: iso(0), by: createdBy, note: "Order placed" }];
  if (status !== "pending") {
    if (status === "cancelled") history.push({ status, at: iso(3), by: "Demo Admin", note: "Order cancelled" });
    else {
      history.push({ status: "processing", at: iso(2), by: "Demo Admin", note: "Order confirmed" });
      if (status === "shipped" || status === "delivered") history.push({ status: "shipped", at: iso(20), by: "Sara Ali", note: "Handed to courier" });
      if (status === "delivered") history.push({ status: "delivered", at: iso(70), by: "Sara Ali", note: "Delivered to customer" });
    }
  }
  return {
    id: idx + 1, number, customerName, customerEmail, createdBy, status, createdAt: iso(0),
    items, subtotal, shipping, tax, discount: 0, total: r2(subtotal + shipping + tax), history,
  };
}

let db: OrderDetails[] = SEED.map(build);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LATENCY = 350;
const notFound = () => new ApiError(404, "Order not found", { serverMessage: "Order not found" });
const find = (id: Id) => db.find((o) => String(o.id) === String(id));

function transition(id: Id, action: "confirm" | "cancel") {
  const o = find(id);
  if (!o) throw notFound();
  if (!allowedActions(o).includes(action)) {
    const msg = `Order #${o.number} can’t be ${action === "confirm" ? "confirmed" : "cancelled"} because it is ${STATUS_LABEL[o.status].toLowerCase()}.`;
    throw new ApiError(409, msg, { serverMessage: msg });
  }
  const to = ACTION_RULES[action].to;
  const event = { status: to, at: new Date().toISOString(), by: "Demo Admin", note: action === "confirm" ? "Order confirmed" : "Order cancelled" };
  db = db.map((x) => (x.id === o.id ? { ...x, status: to, history: [...x.history, event] } : x));
}

const clone = (o: OrderDetails): OrderDetails => ({ ...o, items: o.items.map((i) => ({ ...i })), history: o.history.map((h) => ({ ...h })) });

export const mockOrdersApi: OrdersApi = {
  async list(p) {
    await sleep(LATENCY);
    const r = paginate(filterOrders(db, p), p.page, p.pageSize);
    return { items: r.items.map((o) => ({ id: o.id, number: o.number, customerName: o.customerName, createdAt: o.createdAt, total: o.total, status: o.status })), total: r.total };
  },
  async get(id) {
    await sleep(LATENCY);
    const o = find(id);
    if (!o) throw notFound();
    return clone(o);
  },
  async confirm(id) {
    await sleep(LATENCY);
    transition(id, "confirm");
  },
  async cancel(id) {
    await sleep(LATENCY);
    transition(id, "cancel");
  },
};
