import type { CatalogApi } from "../catalogApi";
import { ApiError } from "../../lib/http";
import { delay } from "../mockSwitch";
import type { CatalogCategory, CatalogQuery, ShopProduct } from "../../types/shop";

/*
  Public catalog mock used while VITE_USE_MOCK=true.
  Handy search triggers:
    !error → 500, !429 → rate limited, !slow → 3 s delay.
*/

// name, category, price, stock
const SEED: [string, string, number, number][] = [
  ["Wireless Mouse", "Accessories", 450, 142],
  ["USB-C Charging Cable", "Accessories", 120, 9],
  ["Laptop Stand", "Accessories", 650, 0],
  ["Mechanical Keyboard", "Accessories", 1850, 36],
  ["Webcam 1080p", "Electronics", 1300, 18],
  ['27" Monitor', "Electronics", 7800, 12],
  ["Portable SSD 1TB", "Electronics", 3400, 7],
  ["Wi-Fi Router AX3000", "Electronics", 2900, 25],
  ["Smart Plug", "Electronics", 350, 0],
  ["Power Bank 20000mAh", "Electronics", 1100, 54],
  ["Bluetooth Speaker", "Audio", 1750, 31],
  ["Noise-Cancelling Headphones", "Audio", 5200, 6],
  ["Wired Earbuds", "Audio", 180, 210],
  ["Studio Microphone", "Audio", 2600, 14],
  ["Soundbar 2.1", "Audio", 4300, 0],
  ["A4 Paper Ream (500)", "Office", 140, 480],
  ["Gel Pens (12 pack)", "Office", 85, 22],
  ["Desk Organizer", "Office", 310, 63],
  ["Whiteboard 90×60", "Office", 720, 11],
  ["LED Desk Lamp", "Home", 540, 47],
  ["Electric Kettle 1.7L", "Home", 780, 29],
  ["Ergonomic Office Chair", "Furniture", 4900, 16],
  ["Standing Desk 120cm", "Furniture", 8700, 4],
];

const PALETTE = [
  ["#ffe4d0", "#a83c00"],
  ["#dbeafe", "#1d4ed8"],
  ["#dcfce7", "#166534"],
  ["#fef3c7", "#92400e"],
  ["#ede9fe", "#5b21b6"],
];

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

const CATEGORIES: CatalogCategory[] = [...new Set(SEED.map((row) => row[1]))]
  .sort((a, b) => a.localeCompare(b))
  .map((name) => ({ id: categoryId(name), name }));

const CATALOG: ShopProduct[] = SEED.map(([name, category, price, stock], i) => ({
  id: `p-${i + 1}`,
  name,
  description: `${name} — available from the Prodexa storefront.`,
  price,
  imageUrl: thumbnail(name, i),
  category,
  categoryId: categoryId(category),
  inStock: stock > 0,
  maxOrderable: Math.min(stock, 20),
}));

/** Read-only catalogue for the other mock APIs (e.g. customer checkout). */
export const MOCK_CATALOG: readonly ShopProduct[] = CATALOG;

function compare(a: ShopProduct, b: ShopProduct, sort: CatalogQuery["sort"]): number {
  if (sort === "price") return a.price - b.price;
  if (sort === "name") return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  // newest: the mock ids are stable, so the last-added row is the newest.
  return a.id.localeCompare(b.id, undefined, { numeric: true });
}

export const mockCatalogApi: CatalogApi = {
  async list(query) {
    const term = query.search.trim().toLowerCase();
    if (term === "!slow") await delay(3000);
    else await delay(350);
    if (term === "!error") throw new ApiError(500, "The server ran into a problem. Please try again shortly.");
    if (term === "!429") throw new ApiError(429, "Too many requests. Please slow down and try again.");

    let rows = CATALOG.filter(
      (p) => (!term || p.name.toLowerCase().includes(term)) && (!query.category || p.categoryId === query.category),
    );

    rows = [...rows].sort((a, b) => compare(a, b, query.sort) * (query.order === "desc" ? -1 : 1) || a.id.localeCompare(b.id));

    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    const start = (query.page - 1) * query.pageSize;
    return { items: rows.slice(start, start + query.pageSize), total, totalPages, page: query.page };
  },

  async get(id) {
    await delay(300);
    const row = CATALOG.find((p) => p.id === id);
    if (!row) throw new ApiError(404, "We couldn't find what you were looking for.");
    return { ...row };
  },

  async categories() {
    await delay(150);
    return CATEGORIES;
  },
};
