export interface DateRange {
  from: string; // YYYY-MM-DD, inclusive
  to: string; // YYYY-MM-DD, inclusive
}

export interface Kpi {
  value: number;
  /** % change versus the previous period of the same length; null = unknown. */
  change: number | null;
}

export interface Summary {
  totalSales: Kpi;
  totalOrders: Kpi;
  averageOrderValue: Kpi;
  productsSold: Kpi;
}

export type Granularity = "day" | "week" | "month";

export interface SalesPoint {
  date: string; // first day of the bucket, YYYY-MM-DD
  total: number;
}

export interface SalesOverview {
  granularity: Granularity;
  points: SalesPoint[];
}

export interface CategorySales {
  name: string;
  total: number;
}

export interface TopProduct {
  id: string | number | null;
  name: string;
  sku: string;
  units: number;
  revenue: number;
}

/** Same shape for the mock and the real API, so switching is one line. */
export interface ReportsApi {
  summary(range: DateRange): Promise<Summary>;
  overview(range: DateRange): Promise<SalesOverview>;
  categories(range: DateRange): Promise<CategorySales[]>;
  topProducts(range: DateRange, limit: number): Promise<TopProduct[]>;
  exportCsv(range: DateRange): Promise<{ blob: Blob; filename: string }>;
}
