import { addDays, dayNumber, daysIn, isoOfDayNumber } from "./dates";
import type { CategorySales, DateRange, Granularity, ReportsApi, SalesOverview, Summary, TopProduct } from "./types";

/*
  In-memory stand-in for the dashboard endpoints, used until the backend is merged.
  Numbers are generated from the date itself, so every range gives consistent results:
  KPIs, the bar chart, the donut and the top products all add up to the same totals.
*/

const PRODUCTS = [
  { name: "Wireless Bluetooth Headphones", sku: "SKU-1842", category: "Electronics", price: 79.99, weight: 14 },
  { name: "Organic Cotton T-Shirt (M)", sku: "SKU-2956", category: "Apparel", price: 24.99, weight: 20 },
  { name: "Stainless Steel Water Bottle", sku: "SKU-3421", category: "Accessories", price: 19.99, weight: 16 },
  { name: "Laptop Backpack", sku: "SKU-4187", category: "Accessories", price: 49.99, weight: 12 },
  { name: "Smart Watch", sku: "SKU-5623", category: "Electronics", price: 199.99, weight: 6 },
  { name: "Running Shoes", sku: "SKU-6732", category: "Apparel", price: 69.99, weight: 12 },
  { name: "Coffee Maker", sku: "SKU-7841", category: "Home & Kitchen", price: 89.99, weight: 8 },
  { name: "Desk Lamp", sku: "SKU-8120", category: "Home & Kitchen", price: 29.99, weight: 12 },
  { name: "Yoga Mat", sku: "SKU-9001", category: "Others", price: 24.5, weight: 14 },
  { name: "Notebook Pack", sku: "SKU-9203", category: "Others", price: 12.99, weight: 18 },
  { name: "Wireless Mouse", sku: "SKU-9304", category: "Electronics", price: 22.5, weight: 12 },
];
const CATEGORY_ORDER = ["Electronics", "Apparel", "Accessories", "Home & Kitchen", "Others"];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Day {
  orders: number;
  units: number[]; // per product
  sales: number;
}
const cache = new Map<number, Day>();

function dayData(n: number): Day {
  const hit = cache.get(n);
  if (hit) return hit;
  const r = rng(n * 2654435761);
  const weekday = (n + 3) % 7; // 0 = Monday
  const factor = (weekday >= 5 ? 1.3 : 1) * 1.35;
  const units = PRODUCTS.map((p) => Math.round(p.weight * factor * (0.6 + 0.8 * r())));
  const totalUnits = units.reduce((a, b) => a + b, 0);
  const sales = units.reduce((s, u, i) => s + Math.round(u * PRODUCTS[i].price * 100), 0) / 100;
  const d = { orders: Math.max(1, Math.round(totalUnits / (2 + r() * 0.8))), units, sales };
  cache.set(n, d);
  return d;
}

const eachDay = (r: DateRange) => Array.from({ length: daysIn(r) }, (_, i) => dayNumber(r.from) + i);
const r2 = (x: number) => Math.round(x * 100) / 100;

function totals(r: DateRange) {
  let sales = 0, orders = 0, units = 0;
  for (const n of eachDay(r)) {
    const d = dayData(n);
    sales += d.sales; orders += d.orders; units += d.units.reduce((a, b) => a + b, 0);
  }
  return { sales: r2(sales), orders, units, aov: orders ? r2(sales / orders) : 0 };
}

const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null);

function granularityFor(r: DateRange): Granularity {
  const d = daysIn(r);
  return d <= 31 ? "day" : d <= 120 ? "week" : "month";
}

function bucketStart(iso: string, g: Granularity): string {
  if (g === "day") return iso;
  if (g === "month") return `${iso.slice(0, 7)}-01`;
  const n = dayNumber(iso);
  return isoOfDayNumber(n - ((n + 3) % 7)); // Monday
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LATENCY = 300;

export const mockReportsApi: ReportsApi = {
  async summary(range) {
    await sleep(LATENCY);
    const len = daysIn(range);
    const prev = totals({ from: addDays(range.from, -len), to: addDays(range.from, -1) });
    const cur = totals(range);
    return {
      totalSales: { value: cur.sales, change: pct(cur.sales, prev.sales) },
      totalOrders: { value: cur.orders, change: pct(cur.orders, prev.orders) },
      averageOrderValue: { value: cur.aov, change: pct(cur.aov, prev.aov) },
      productsSold: { value: cur.units, change: pct(cur.units, prev.units) },
    } satisfies Summary;
  },

  async overview(range): Promise<SalesOverview> {
    await sleep(LATENCY);
    const g = granularityFor(range);
    const sums = new Map<string, number>();
    for (const n of eachDay(range)) {
      const key = bucketStart(isoOfDayNumber(n), g);
      sums.set(key, (sums.get(key) ?? 0) + dayData(n).sales);
    }
    return { granularity: g, points: [...sums.entries()].map(([date, total]) => ({ date, total: r2(total) })) };
  },

  async categories(range): Promise<CategorySales[]> {
    await sleep(LATENCY);
    const sums = new Map<string, number>(CATEGORY_ORDER.map((c) => [c, 0]));
    for (const n of eachDay(range)) {
      const d = dayData(n);
      PRODUCTS.forEach((p, i) => sums.set(p.category, (sums.get(p.category) ?? 0) + Math.round(d.units[i] * p.price * 100) / 100));
    }
    return [...sums.entries()].map(([name, total]) => ({ name, total: r2(total) })).sort((a, b) => b.total - a.total);
  },

  async topProducts(range, limit): Promise<TopProduct[]> {
    await sleep(LATENCY);
    const units = PRODUCTS.map(() => 0);
    for (const n of eachDay(range)) dayData(n).units.forEach((u, i) => (units[i] += u));
    return PRODUCTS.map((p, i) => ({ id: p.sku, name: p.name, sku: p.sku, units: units[i], revenue: r2(units[i] * p.price) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  },

  async exportCsv(range) {
    await sleep(LATENCY);
    const rows = ["Date,Orders,Products sold,Sales"];
    for (const n of eachDay(range)) {
      const d = dayData(n);
      rows.push(`${isoOfDayNumber(n)},${d.orders},${d.units.reduce((a, b) => a + b, 0)},${d.sales.toFixed(2)}`);
    }
    return { blob: new Blob([rows.join("\n") + "\n"], { type: "text/csv" }), filename: `sales-report_${range.from}_${range.to}.csv` };
  },
};
