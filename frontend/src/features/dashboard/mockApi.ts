import { delay } from "../../api/mockSwitch";
import { deriveStockStatus } from "../../api/productMappers";
import { dayNumber, daysIn, isoOfDayNumber } from "../../lib/dateRange";
import type { InventoryProduct, ProductPage } from "../../types/inventory";
import type { DashboardApi, DashboardSummary, DateRange, SalesDay, StockMovementDay, TopProduct } from "./types";

/*
  In-memory stand-in for the dashboard endpoints while VITE_USE_MOCK=true.
  Values are derived from the calendar day, so every range is consistent and
  repeated renders do not jump around.
*/

const PRODUCTS: TopProduct[] = [
  { productId: "p-wm-204", productName: "Wireless Mouse", sku: "WM-204", quantitySold: 96, revenue: 43_200 },
  { productId: "p-kb-310", productName: "Mechanical Keyboard", sku: "KB-310", quantitySold: 41, revenue: 75_850 },
  { productId: "p-pb-200", productName: "Power Bank 20000mAh", sku: "PB-200", quantitySold: 38, revenue: 41_800 },
  { productId: "p-hp-900", productName: "Noise-Cancelling Headphones", sku: "HP-900", quantitySold: 12, revenue: 62_400 },
  { productId: "p-pp-500", productName: "A4 Paper Ream (500)", sku: "PP-500", quantitySold: 120, revenue: 16_800 },
];

const LOW_STOCK: InventoryProduct[] = [
  {
    id: "p-uc-110",
    name: "USB-C Charging Cable",
    sku: "UC-110",
    categoryId: "c-accessories",
    category: "Accessories",
    price: 120,
    costPrice: 55,
    stock: 9,
    reorderLevel: 25,
    status: "low_stock",
  },
  {
    id: "p-ss-100",
    name: "Portable SSD 1TB",
    sku: "SS-100",
    categoryId: "c-electronics",
    category: "Electronics",
    price: 3_400,
    costPrice: 2_700,
    stock: 7,
    reorderLevel: 10,
    status: "low_stock",
  },
  {
    id: "p-hp-900",
    name: "Noise-Cancelling Headphones",
    sku: "HP-900",
    categoryId: "c-audio",
    category: "Audio",
    price: 5_200,
    costPrice: 3_900,
    stock: 6,
    reorderLevel: 8,
    status: "low_stock",
  },
  {
    id: "p-st-310",
    name: "Stapler Heavy Duty",
    sku: "ST-310",
    categoryId: "c-office",
    category: "Office",
    price: 260,
    costPrice: 150,
    stock: 8,
    reorderLevel: 10,
    status: "low_stock",
  },
];

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

const eachDay = (r: DateRange) => Array.from({ length: daysIn(r) }, (_, i) => dayNumber(r.from) + i);

const salesFor = (n: number) => {
  const r = rng(n * 2654435761);
  const weekday = (n + 3) % 7;
  const orders = Math.round((weekday >= 5 ? 6 : 3) * (0.4 + r()));
  return { totalSales: Math.round(orders * (220 + r() * 180) * 100) / 100, orderCount: orders };
};

const movementsFor = (n: number) => {
  const r = rng(n * 40503 + 17);
  return { unitsIn: Math.round(r() * 24), unitsOut: Math.round(r() * 18) };
};

export const mockDashboardApi: DashboardApi = {
  async summary(range) {
    await delay(250);
    const days = eachDay(range).map(salesFor);
    return {
      totalProducts: 42,
      totalStockUnits: 1_364,
      stockValue: 1_248_500,
      lowStockCount: LOW_STOCK.length,
      outOfStockCount: 3,
      ordersInPeriod: days.reduce((sum, d) => sum + d.orderCount, 0),
      revenueInPeriod: Math.round(days.reduce((sum, d) => sum + d.totalSales, 0) * 100) / 100,
      period: { from: range.from, to: range.to },
    } satisfies DashboardSummary;
  },

  async sales(range) {
    await delay(250);
    return eachDay(range).map((n) => {
      const day = salesFor(n);
      return { date: isoOfDayNumber(n), totalSales: day.totalSales, orderCount: day.orderCount } satisfies SalesDay;
    });
  },

  async topProducts(_range, limit) {
    await delay(250);
    return PRODUCTS.slice(0, limit);
  },

  async stockMovements(range) {
    await delay(250);
    return eachDay(range).map((n) => {
      const day = movementsFor(n);
      return { date: isoOfDayNumber(n), unitsIn: day.unitsIn, unitsOut: day.unitsOut } satisfies StockMovementDay;
    });
  },

  async lowStock(page, limit) {
    await delay(250);
    const start = (page - 1) * limit;
    return {
      items: LOW_STOCK.slice(start, start + limit).map((p) => ({
        ...p,
        status: deriveStockStatus(p.stock, p.reorderLevel),
      })),
      total: LOW_STOCK.length,
    } satisfies ProductPage;
  },
};
