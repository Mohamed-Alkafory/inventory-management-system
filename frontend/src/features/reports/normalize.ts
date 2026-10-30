import type { CategorySales, Granularity, Kpi, SalesOverview, Summary, TopProduct } from "./types";

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null;
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const num = (v: unknown) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
};
const first = <T,>(...c: Array<T | undefined>) => c.find((x) => x !== undefined);
const list = (body: unknown, ...keys: string[]): unknown[] => {
  if (Array.isArray(body)) return body;
  if (isObject(body)) for (const k of keys) if (Array.isArray(body[k])) return body[k] as unknown[];
  return [];
};

const KPI_KEYS = {
  totalSales: ["totalSales", "total_sales", "sales", "revenue", "totalRevenue"],
  totalOrders: ["totalOrders", "total_orders", "orders", "ordersCount"],
  averageOrderValue: ["averageOrderValue", "average_order_value", "avgOrderValue", "avg_order_value", "aov"],
  productsSold: ["productsSold", "products_sold", "unitsSold", "units_sold", "itemsSold", "totalProductsSold"],
} as const;

const read = (o: Obj, keys: readonly string[]) => first(...keys.map((k) => num(o[k])));

/** Accepts plain values, `{ value, change }` objects, a `changes` map (percent) or a `previous` map (values). */
export function normalizeSummary(body: unknown): Summary {
  const b: Obj = isObject(body) ? (isObject(body.data) ? body.data : body) : {};
  const changes: Obj = [b.changes, b.change, b.growth, b.deltas].find(isObject) ?? {};
  const previous: Obj = [b.previous, b.previousPeriod, b.previous_period].find(isObject) ?? {};

  const kpi = (name: keyof typeof KPI_KEYS): Kpi => {
    const keys = KPI_KEYS[name];
    const raw = first(...keys.map((k) => b[k]));
    const own = isObject(raw) ? raw : null;
    const value = own ? (num(own.value) ?? num(own.total) ?? 0) : (num(raw) ?? 0);
    let change: number | null = own ? (num(own.change) ?? num(own.changePercent) ?? num(own.growth) ?? null) : null;
    if (change === null) change = read(changes, keys) ?? null;
    if (change === null) {
      const prev = read(previous, keys);
      if (prev !== undefined && prev !== 0) change = ((value - prev) / prev) * 100;
    }
    return { value, change };
  };

  return { totalSales: kpi("totalSales"), totalOrders: kpi("totalOrders"), averageOrderValue: kpi("averageOrderValue"), productsSold: kpi("productsSold") };
}

export function normalizeOverview(body: unknown): SalesOverview {
  const b: Obj = isObject(body) ? body : {};
  const g = str(b.granularity)?.toLowerCase() ?? str(b.interval)?.toLowerCase() ?? str(b.groupBy)?.toLowerCase();
  const granularity: Granularity = g === "week" || g === "weekly" ? "week" : g === "month" || g === "monthly" ? "month" : "day";
  const points = list(body, "points", "data", "series", "items").flatMap((p) => {
    if (!isObject(p)) return [];
    const date = str(p.date) ?? str(p.day) ?? str(p.period) ?? str(p.label) ?? str(p.x);
    const total = num(p.total) ?? num(p.sales) ?? num(p.value) ?? num(p.amount) ?? num(p.revenue);
    return date && total !== undefined ? [{ date: date.slice(0, 10), total }] : [];
  });
  return { granularity, points };
}

export function normalizeCategories(body: unknown): CategorySales[] {
  return list(body, "data", "items", "categories").flatMap((c) => {
    if (!isObject(c)) return [];
    const name = str(c.name) ?? str(c.category) ?? str(c.categoryName) ?? str(c.category_name);
    const total = num(c.total) ?? num(c.sales) ?? num(c.value) ?? num(c.amount) ?? num(c.revenue);
    return name && total !== undefined ? [{ name, total }] : [];
  });
}

export function normalizeTopProducts(body: unknown): TopProduct[] {
  return list(body, "data", "items", "products").flatMap((p) => {
    if (!isObject(p)) return [];
    const product: Obj = isObject(p.product) ? p.product : {};
    const name = str(p.name) ?? str(p.productName) ?? str(p.product_name) ?? str(product.name);
    if (!name) return [];
    const idRaw = p.productId ?? p.product_id ?? product.id ?? p.id;
    return [
      {
        id: typeof idRaw === "string" || typeof idRaw === "number" ? idRaw : null,
        name,
        sku: str(p.sku) ?? str(product.sku) ?? "",
        units: num(p.units) ?? num(p.unitsSold) ?? num(p.units_sold) ?? num(p.quantity) ?? num(p.quantitySold) ?? num(p.quantity_sold) ?? 0,
        revenue: num(p.revenue) ?? num(p.total) ?? num(p.sales) ?? num(p.amount) ?? 0,
      },
    ];
  });
}
