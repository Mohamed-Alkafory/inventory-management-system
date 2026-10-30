import type { DateRange } from "../../lib/dateRange";
import type { ProductPage } from "../../types/inventory";

export type { DateRange };

/** GET /dashboard/summary */
export interface DashboardSummary {
  totalProducts: number;
  totalStockUnits: number;
  stockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  ordersInPeriod: number;
  revenueInPeriod: number;
  period: { from: string; to: string };
}

/** GET /dashboard/sales - every day of the period is present (zero filled). */
export interface SalesDay {
  date: string;
  totalSales: number;
  orderCount: number;
}

/** GET /dashboard/top-products */
export interface TopProduct {
  productId: string;
  productName: string;
  sku: string;
  quantitySold: number;
  revenue: number;
}

/** GET /dashboard/stock-movements - every day of the period is present (zero filled). */
export interface StockMovementDay {
  date: string;
  unitsIn: number;
  unitsOut: number;
}

/** Same shape for the mock and the real API, so switching is one line. */
export interface DashboardApi {
  summary(range: DateRange): Promise<DashboardSummary>;
  sales(range: DateRange): Promise<SalesDay[]>;
  topProducts(range: DateRange, limit: number): Promise<TopProduct[]>;
  stockMovements(range: DateRange): Promise<StockMovementDay[]>;
  lowStock(page: number, limit: number): Promise<ProductPage>;
}
