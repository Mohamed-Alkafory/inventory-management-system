import { MOCK_CATALOG } from "../../api/mock/catalogMock";
import { tokenStorage } from "../../api/tokenStorage";
import { ApiError } from "../../lib/http";
import { filterMyOrders, filterOrders, paginate } from "./filters";
import { STATUS_LABEL } from "./status";
import type {
  CreateMyOrderInput,
  CustomerOrder,
  CustomerOrdersApi,
  Id,
  OrderNote,
  OrderStatus,
  StaffOrder,
  StaffOrdersApi,
} from "./types";

/*
  In-memory stand-in for the backend, used until the real API is merged
  (VITE_USE_MOCK=true). It keeps BOTH response shapes and mirrors the exact
  permission/transition rules:

    customer  /orders/mine*      own orders only; a foreign order is 404
    staff     /orders*           all orders; PENDING cancel only on /cancel,
                                 PATCH status for CONFIRMED/CANCELLED

  Data resets on page reload.
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

interface MockLine {
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface MockOrder {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  recipientName: string;
  recipientPhone: string;
  shippingAddress: string;
  shippingCity: string;
  paymentMethod: string;
  notes: string;
  createdById: string;
  createdByName: string;
  createdByEmail: string;
  createdAt: string;
  cancelledAt: string | null;
  items: MockLine[];
}

const OWN_CUSTOMER = "4"; // Cara Customer — see api/mock/authMock.ts

// number, customer, phone, customerId, createdBy, status, lines, shipping
const SEED: Array<
  [string, string, string, string, string, OrderStatus, Array<[Key, number]>, number]
> = [
  ["ORD-1001", "Ahmed Mohamed", "+20 101 300 1000", OWN_CUSTOMER, "Sami Staff", "PENDING", [["headphones", 1], ["bottle", 2]], 9.99],
  ["ORD-1002", "Sarah Ali", "+20 102 317 1113", OWN_CUSTOMER, "Amira Admin", "CONFIRMED", [["watch", 1], ["backpack", 1]], 0],
  ["ORD-1003", "Omar Hassan", "+20 103 334 1226", OWN_CUSTOMER, "Sami Staff", "CONFIRMED", [["tshirt", 2], ["shoes", 1]], 0],
  ["ORD-1004", "Fatima Ahmed", "+20 104 351 1339", OWN_CUSTOMER, "Amira Admin", "CONFIRMED", [["coffee", 1], ["lamp", 2]], 0],
  ["ORD-1005", "Khaled Salem", "+20 105 368 1452", OWN_CUSTOMER, "Amira Admin", "CANCELLED", [["bottle", 3], ["lamp", 1]], 9.99],
  ["ORD-1006", "Layla Mostafa", "+20 106 385 1565", OWN_CUSTOMER, "Sami Staff", "PENDING", [["shoes", 2], ["tshirt", 1]], 0],
  ["ORD-1007", "Youssef Khaled", "+20 107 402 1678", OWN_CUSTOMER, "Amira Admin", "CANCELLED", [["lamp", 2]], 9.99],
  ["ORD-1008", "Nada Hassan", "+20 108 419 1791", OWN_CUSTOMER, "Sami Staff", "CONFIRMED", [["headphones", 2]], 0],
  ["ORD-1009", "Mona Fathy", "+20 109 436 1804", OWN_CUSTOMER, "Amira Admin", "PENDING", [["coffee", 2], ["bottle", 1]], 0],
  // Not owned by the built-in customer — /orders/mine/:id must answer 404 for these.
  ["ORD-1010", "Hany Samir", "+20 110 453 1917", "u-other", "Sami Staff", "PENDING", [["backpack", 2], ["tshirt", 3]], 0],
  ["ORD-1011", "Dina Adel", "+20 111 470 2030", "u-other", "Amira Admin", "CANCELLED", [["watch", 1]], 0],
  ["ORD-1012", "Tarek Wahba", "+20 112 487 2143", "u-other", "Sami Staff", "CONFIRMED", [["shoes", 1], ["lamp", 1]], 9.99],
];

function build(row: (typeof SEED)[number], idx: number): MockOrder {
  const [orderNumber, customerName, customerPhone, customerId, createdByName, status, lines] = row;
  const items: MockLine[] = lines.map(([k, quantity]) => {
    const lineTotal = r2(CATALOG[k].price * quantity);
    return { productName: CATALOG[k].name, sku: CATALOG[k].sku, quantity, unitPrice: CATALOG[k].price, lineTotal };
  });
  const created = now - (2 + idx * 30) * HOUR; // 30h apart → every order is on its own calendar day
  const iso = (h: number) => new Date(created + h * HOUR).toISOString();

  return {
    id: idx + 1,
    orderNumber,
    status,
    customerId,
    customerName,
    customerPhone,
    recipientName: customerName,
    recipientPhone: customerPhone,
    shippingAddress: `${100 + idx} Nile Street`,
    shippingCity: ["Cairo", "Giza", "Alexandria"][idx % 3],
    paymentMethod: "COD",
    notes: idx % 3 === 0 ? "Please call before delivery" : "",
    createdById: createdByName === "Amira Admin" ? "1" : "2",
    createdByName,
    createdByEmail: createdByName === "Amira Admin" ? "admin@prodexa.com" : "staff@prodexa.com",
    createdAt: iso(0),
    cancelledAt: status === "CANCELLED" ? iso(3) : null,
    items,
  };
}

let db: MockOrder[] = SEED.map(build);

/** Internal notes are a separate thread; they never appear in customer responses. */
let notesDb: OrderNote[] = [
  {
    id: "note-1",
    orderId: "1",
    authorId: "2",
    note: "Customer asked us to call before delivery.",
    author: { id: "2", name: "Sami Staff" },
    createdAt: new Date(now - 8 * HOUR).toISOString(),
  },
  {
    id: "note-2",
    orderId: "2",
    authorId: "1",
    note: "Confirmed by phone. Courier booked.",
    author: { id: "1", name: "Amira Admin" },
    createdAt: new Date(now - 6 * HOUR).toISOString(),
  },
];

const totalOf = (o: MockOrder) => r2(o.items.reduce((sum, line) => sum + line.lineTotal, 0));

function toCustomerOrder(o: MockOrder): CustomerOrder {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    totalAmount: totalOf(o),
    items: o.items.map((line) => ({ ...line })),
    recipientName: o.recipientName || undefined,
    recipientPhone: o.recipientPhone || undefined,
    shippingAddress: o.shippingAddress || undefined,
    shippingCity: o.shippingCity || undefined,
    paymentMethod: o.paymentMethod || undefined,
    createdAt: o.createdAt,
    cancelledAt: o.cancelledAt ?? undefined,
  };
}

function toStaffOrder(o: MockOrder, detail: boolean): StaffOrder {
  const base: StaffOrder = {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    customerName: o.customerName || undefined,
    customerPhone: o.customerPhone || undefined,
    notes: o.notes || undefined,
    totalAmount: totalOf(o),
    customerId: o.customerId,
    recipientName: o.recipientName || undefined,
    recipientPhone: o.recipientPhone || undefined,
    shippingAddress: o.shippingAddress || undefined,
    shippingCity: o.shippingCity || undefined,
    paymentMethod: o.paymentMethod || undefined,
    createdById: o.createdById,
    cancelledAt: o.cancelledAt ?? undefined,
    createdAt: o.createdAt,
    updatedAt: o.createdAt,
  };
  if (!detail) return base;
  return {
    ...base,
    items: o.items.map((line, n) => ({ id: `${o.id}-${n + 1}`, ...line })),
    createdBy: { id: o.createdById, name: o.createdByName, email: o.createdByEmail },
    stockMovements: [],
  };
}

/** Used by the "create order" mock so a new order shows up in the staff list and details. */
export function addMockOrder(input: {
  customerName: string;
  customerPhone: string;
  notes: string;
  items: Array<{ name: string; sku: string; quantity: number; unitPrice: number }>;
}): { id: number; number: string } {
  const id = Math.max(0, ...db.map((o) => o.id)) + 1;
  const orderNumber = `ORD-${1000 + id}`;
  const at = new Date().toISOString();
  const items: MockLine[] = input.items.map((i) => ({
    productName: i.name,
    sku: i.sku,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    lineTotal: r2(i.quantity * i.unitPrice),
  }));
  db = [
    ...db,
    {
      id,
      orderNumber,
      status: "PENDING",
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      recipientName: input.customerName,
      recipientPhone: input.customerPhone,
      shippingAddress: "",
      shippingCity: "",
      paymentMethod: "COD",
      notes: input.notes,
      createdById: "1",
      createdByName: "Amira Admin",
      createdByEmail: "admin@prodexa.com",
      createdAt: at,
      cancelledAt: null,
      items,
    },
  ];
  return { id, number: orderNumber };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LATENCY = 350;
const notFound = () => new ApiError(404, "Order not found", { serverMessage: "Order not found" });
const find = (id: Id) => db.find((o) => String(o.id) === String(id));

function badRequest(message: string): ApiError {
  return new ApiError(400, message, {
    serverMessage: message,
    body: { statusCode: 400, message, error: "VALIDATION_ERROR" },
  });
}

/**
 * POST /orders/mine in the mock: validates the same limits, recomputes every
 * price from the catalogue, and answers 409 naming the product when the
 * requested quantity exceeds the mock's available stock.
 */
function createCustomerOrder(input: CreateMyOrderInput): MockOrder {
  const ids = input.items.map((item) => item.productId);
  if (input.items.length < 1 || input.items.length > 30) {
    throw badRequest("items must contain between 1 and 30 products");
  }
  if (new Set(ids).size !== ids.length) throw badRequest("Duplicate productId in items");

  const items: MockLine[] = input.items.map((item) => {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 50) {
      throw badRequest("quantity must be an integer between 1 and 50");
    }

    const product = MOCK_CATALOG.find((row) => row.id === item.productId);
    if (!product) throw new ApiError(404, `Product ${item.productId} not found`);
    if (!product.inStock || item.quantity > product.maxOrderable) {
      const message = `Insufficient stock: product ${product.id} change -${item.quantity} would push the quantity below zero`;
      throw new ApiError(409, message, {
        serverMessage: message,
        body: { statusCode: 409, message, error: "CONFLICT" },
      });
    }

    return {
      productName: product.name,
      sku: `SKU-${product.id.toUpperCase()}`,
      quantity: item.quantity,
      unitPrice: product.price,
      lineTotal: r2(item.quantity * product.price),
    };
  });

  const customerId = currentCustomerId();
  const sessionUser = tokenStorage.getSession()?.user;
  const id = Math.max(0, ...db.map((o) => o.id)) + 1;
  const orderNumber = `ORD-${1000 + id}`;
  const order: MockOrder = {
    id,
    orderNumber,
    status: "PENDING",
    customerId,
    customerName: input.recipientName,
    customerPhone: input.recipientPhone,
    recipientName: input.recipientName,
    recipientPhone: input.recipientPhone,
    shippingAddress: input.shippingAddress,
    shippingCity: input.shippingCity,
    paymentMethod: "COD",
    notes: input.notes ?? "",
    createdById: customerId,
    createdByName: sessionUser?.name ?? "Cara Customer",
    createdByEmail: sessionUser?.email ?? "customer@prodexa.com",
    createdAt: new Date().toISOString(),
    cancelledAt: null,
    items,
  };
  db = [...db, order];
  return order;
}

function conflict(o: MockOrder, action: "confirm" | "cancel") {
  const verb = action === "confirm" ? "confirmed" : "cancelled";
  const message = `Order #${o.orderNumber} can’t be ${verb} because it is ${STATUS_LABEL[o.status].toLowerCase()}.`;
  return new ApiError(409, message, { serverMessage: message });
}

function currentCustomerId(): string {
  return tokenStorage.getSession()?.user.id ?? OWN_CUSTOMER;
}

function updateStatus(id: Id, status: "CONFIRMED" | "CANCELLED") {
  const order = find(id);
  if (!order) throw notFound();

  const allowed = status === "CONFIRMED" ? order.status === "PENDING" : order.status === "PENDING" || order.status === "CONFIRMED";
  if (!allowed) throw conflict(order, status === "CONFIRMED" ? "confirm" : "cancel");

  db = db.map((o) =>
    o.id === order.id
      ? { ...o, status, cancelledAt: status === "CANCELLED" ? new Date().toISOString() : o.cancelledAt }
      : o,
  );
}

/** Staff list: every order (SUPPORT/STAFF/ADMIN). */
export const mockStaffOrdersApi: StaffOrdersApi = {
  async listOrders(p) {
    await sleep(LATENCY);
    const rows = filterOrders(db.map((o) => toStaffOrder(o, false)), p);
    return paginate(rows, p.page, p.pageSize);
  },
  async getOrder(id) {
    await sleep(LATENCY);
    const order = find(id);
    if (!order) throw notFound();
    return toStaffOrder(order, true);
  },
  async updateOrderStatus(id, status) {
    await sleep(LATENCY);
    updateStatus(id, status);
  },
  async cancelOrder(id) {
    await sleep(LATENCY);
    const order = find(id);
    if (!order) throw notFound();
    if (order.status !== "PENDING") throw conflict(order, "cancel");
    updateStatus(id, "CANCELLED");
  },
  async listNotes(id) {
    await sleep(LATENCY);
    if (!find(id)) throw notFound();
    return notesDb
      .filter((note) => note.orderId === String(id))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  async addNote(id, note) {
    await sleep(LATENCY);
    if (!find(id)) throw notFound();
    const trimmed = note.trim();
    if (trimmed.length < 1 || trimmed.length > 2000) {
      throw badRequest("note must be between 1 and 2000 characters");
    }
    const user = tokenStorage.getSession()?.user;
    const created: OrderNote = {
      id: `note-${notesDb.length + 1}`,
      orderId: String(id),
      authorId: user?.id ?? "support",
      note: trimmed,
      author: { id: user?.id ?? "support", name: user?.name ?? "Support user" },
      createdAt: new Date().toISOString(),
    };
    notesDb = [...notesDb, created];
    return created;
  },
};

/** Customer scope: only the signed-in customer's orders. */
export const mockCustomerOrdersApi: CustomerOrdersApi = {
  async listMyOrders(p) {
    await sleep(LATENCY);
    const mine = db.filter((o) => o.customerId === currentCustomerId()).map(toCustomerOrder);
    return paginate(filterMyOrders(mine, p), p.page, p.pageSize);
  },
  async getMyOrder(id) {
    await sleep(LATENCY);
    const order = db.find((o) => String(o.id) === String(id) && o.customerId === currentCustomerId());
    if (!order) throw notFound(); // foreign orders look exactly like missing ones
    return toCustomerOrder(order);
  },
  async cancelMyOrder(id) {
    await sleep(LATENCY);
    const order = db.find((o) => String(o.id) === String(id) && o.customerId === currentCustomerId());
    if (!order) throw notFound();
    if (order.status !== "PENDING") throw conflict(order, "cancel");
    updateStatus(id, "CANCELLED");
  },
  async createMyOrder(input) {
    await sleep(LATENCY);
    return toCustomerOrder(createCustomerOrder(input));
  },
};
