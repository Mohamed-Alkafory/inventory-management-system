import type { ProductsApi } from "../productsApi";
import { ApiError } from "../errors";
import { deriveStockStatus } from "../productMappers";
import { delay } from "../mockSwitch";
import { tokenStorage } from "../tokenStorage";
import type { InventoryProduct, ProductCategory, ProductQuery } from "../../types/inventory";

/*
  Mock catalogue used while VITE_USE_MOCK=true.
  Handy for testing the page:
    - search for  !error  → the request fails (error state)
    - search for  !slow   → the request takes 3 s (loading state)
*/

// name, sku, category, price, costPrice, stock, reorderLevel
const SEED: [string, string, string, number, number, number, number][] = [
  ["Wireless Mouse", "WM-204", "Accessories", 450, 280, 142, 40],
  ["USB-C Charging Cable", "UC-110", "Accessories", 120, 55, 9, 25],
  ["Laptop Stand", "LS-031", "Accessories", 650, 380, 0, 15],
  ["Mechanical Keyboard", "KB-310", "Accessories", 1850, 1200, 36, 15],
  ["Webcam 1080p", "WC-120", "Electronics", 1300, 850, 18, 10],
  ["27\" Monitor", "MN-270", "Electronics", 7800, 6100, 12, 8],
  ["Portable SSD 1TB", "SS-100", "Electronics", 3400, 2700, 7, 10],
  ["Wi-Fi Router AX3000", "RT-300", "Electronics", 2900, 2200, 25, 10],
  ["Smart Plug", "SP-050", "Electronics", 350, 190, 0, 20],
  ["Power Bank 20000mAh", "PB-200", "Electronics", 1100, 720, 54, 20],
  ["Bluetooth Speaker", "SK-440", "Audio", 1750, 1150, 31, 12],
  ["Noise-Cancelling Headphones", "HP-900", "Audio", 5200, 3900, 6, 8],
  ["Wired Earbuds", "EB-015", "Audio", 180, 90, 210, 50],
  ["Studio Microphone", "MC-250", "Audio", 2600, 1850, 14, 6],
  ["Soundbar 2.1", "SB-210", "Audio", 4300, 3300, 0, 5],
  ["A4 Paper Ream (500)", "PP-500", "Office", 140, 95, 480, 100],
  ["Gel Pens (12 pack)", "PN-012", "Office", 85, 45, 22, 40],
  ["Desk Organizer", "DO-070", "Office", 310, 170, 63, 20],
  ["Whiteboard 90×60", "WB-960", "Office", 720, 480, 11, 5],
  ["Sticky Notes (6 pack)", "SN-006", "Office", 95, 50, 150, 60],
  ["Stapler Heavy Duty", "ST-310", "Office", 260, 150, 8, 10],
  ["LED Desk Lamp", "LD-120", "Home", 540, 330, 47, 15],
  ["Electric Kettle 1.7L", "KT-170", "Home", 780, 520, 29, 10],
  ["Air Fryer 4L", "AF-400", "Home", 3600, 2800, 5, 6],
  ["Storage Box Set (3)", "SB-030", "Home", 410, 240, 0, 12],
  ["Wall Clock", "WC-300", "Home", 230, 120, 74, 20],
  ["Microfiber Cloth Pack", "MF-010", "Home", 70, 30, 320, 80],
  ["Ergonomic Office Chair", "CH-880", "Furniture", 4900, 3600, 16, 6],
  ["Standing Desk 120cm", "DK-120", "Furniture", 8700, 6800, 4, 5],
  ["Bookshelf 5-Tier", "BS-050", "Furniture", 2300, 1700, 13, 5],
  ["Monitor Arm", "MA-100", "Furniture", 980, 620, 38, 10],
  ["Footrest", "FR-020", "Furniture", 390, 230, 9, 10],
  ["HDMI Cable 2m", "HD-020", "Accessories", 110, 50, 165, 40],
  ["Laptop Sleeve 15\"", "LS-150", "Accessories", 290, 160, 52, 20],
  ["Phone Tripod", "TP-045", "Accessories", 260, 140, 0, 15],
  ["Label Printer", "LP-600", "Office", 2100, 1500, 10, 4],
];

const PALETTE = [
  ["#ffe4d0", "#a83c00"],
  ["#dbeafe", "#1d4ed8"],
  ["#dcfce7", "#166534"],
  ["#fef3c7", "#92400e"],
  ["#ede9fe", "#5b21b6"],
];

/** Tiny generated picture (no network, no image files needed). */
function thumbnail(name: string, index: number): string {
  const [bg, fg] = PALETTE[index % PALETTE.length];
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'>` +
    `<rect width='80' height='80' rx='14' fill='${bg}'/>` +
    `<text x='40' y='53' font-family='Arial,sans-serif' font-size='34' font-weight='700' text-anchor='middle' fill='${fg}'>` +
    `${name.charAt(0).toUpperCase()}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const categoryId = (name: string) => `cat-${name.toLowerCase()}`;

const CATEGORIES: ProductCategory[] = [...new Set(SEED.map((row) => row[2]))]
  .sort((a, b) => a.localeCompare(b))
  .map((name) => ({ id: categoryId(name), name }));

const CATALOG: InventoryProduct[] = SEED.map(([name, sku, category, price, costPrice, stock, reorderLevel], i) => ({
  id: `p-${i + 1}`,
  name,
  sku,
  categoryId: categoryId(category),
  category,
  price,
  costPrice,
  stock,
  reorderLevel,
  status: deriveStockStatus(stock, reorderLevel),
  imageUrl: thumbnail(name, i),
}));

const isAdmin = () => tokenStorage.getSession()?.user.role === "ADMIN";

function compare(a: InventoryProduct, b: InventoryProduct, field: NonNullable<ProductQuery["sortBy"]>): number {
  const x = a[field];
  const y = b[field];
  if (typeof x === "number" && typeof y === "number") return x - y;
  return String(x ?? "").localeCompare(String(y ?? ""), undefined, { sensitivity: "base" });
}

export const mockProductsApi: ProductsApi = {
  async get(id) {
    await delay(300);
    const row = CATALOG.find((p) => p.id === id);
    if (!row) throw new ApiError("We couldn't find what you were looking for.", { status: 404 });
    if (isAdmin()) return { ...row };
    const copy = { ...row };
    delete copy.costPrice;
    return copy;
  },

  async list(query) {
    const term = query.search.trim().toLowerCase();
    if (term === "!slow") await delay(3000);
    else await delay(350);
    if (term === "!error") throw new ApiError("The server ran into a problem. Please try again shortly.", { status: 500 });

    const admin = isAdmin();
    let rows = CATALOG.filter(
      (p) =>
        (!term || p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)) &&
        (!query.category || p.categoryId === query.category) &&
        (!query.status || p.status === query.status),
    );

    const sortBy = query.sortBy;
    if (sortBy) {
      const dir = query.sortDir === "desc" ? -1 : 1;
      rows = [...rows].sort((a, b) => compare(a, b, sortBy) * dir || a.id.localeCompare(b.id));
    }

    const start = (query.page - 1) * query.pageSize;
    const items = rows.slice(start, start + query.pageSize).map((p) => {
      if (admin) return { ...p };
      const copy = { ...p };
      delete copy.costPrice;
      return copy;
    });

    return { items, total: rows.length };
  },

  async categories() {
    await delay(150);
    return CATEGORIES;
  },
};
