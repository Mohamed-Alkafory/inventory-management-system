import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { OrderStatus, Prisma } from '../generated/prisma/client.js';
import { StockService } from '../stock/stock.service.js';
import { type PaginationQueryDto } from '../common/dto/pagination.query.dto.js';
import { type ProductListResponse } from '../products/products.service.js';
import { type DateRangeQueryDto } from './dto/date-range.query.dto.js';
import { type TopProductsQueryDto } from './dto/top-products.query.dto.js';

/**
 * Maximum inclusive span of a dashboard date range (issue #33: "cap the
 * maximum range"). 92 days covers a quarter with room for boundary days.
 */
export const MAX_RANGE_DAYS = 92;

/** Inclusive UTC period handed to the queries. */
export interface ResolvedPeriod {
  from: Date;
  to: Date;
}

export interface DashboardSummaryResponse {
  /** Active products only. */
  totalProducts: number;
  /** Sum of `quantity` over active products. */
  totalStockUnits: number;
  /** Sum of `quantity * costPrice` (cost basis — AD-009) over active products. */
  stockValue: number;
  /** Active products at or below `minStock`. */
  lowStockCount: number;
  /** Active products with `quantity = 0`. */
  outOfStockCount: number;
  /** Non-cancelled orders created inside the period. */
  ordersInPeriod: number;
  /** Sum of `totalAmount` of those orders. */
  revenueInPeriod: number;
  period: { from: string; to: string };
}

export interface SalesDayResponse {
  /** `YYYY-MM-DD` (UTC) — every day of the period is present. */
  date: string;
  totalSales: number;
  orderCount: number;
}

export interface TopProductResponse {
  productId: string;
  productName: string;
  sku: string;
  quantitySold: number;
  revenue: number;
}

export interface StockMovementDayResponse {
  /** `YYYY-MM-DD` (UTC) — every day of the period is present. */
  date: string;
  unitsIn: number;
  unitsOut: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** One `orders` day row from the raw aggregate query. */
interface SalesRow {
  day: Date;
  total_sales: Prisma.Decimal | string | number | null;
  order_count: number | bigint;
}

/** One `stock_movements` day row from the raw aggregate query. */
interface MovementRow {
  day: Date;
  units_in: number | bigint;
  units_out: number | bigint;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  /**
   * `GET /dashboard/summary` — headline counters for the period. Uses
   * Prisma `aggregate`/`count` for everything expressible that way; the
   * two column-math figures (stock value and `quantity <= min_stock`)
   * need parameterized `$queryRaw`, which Prisma cannot express.
   */
  async summary(query: DateRangeQueryDto): Promise<DashboardSummaryResponse> {
    const period = resolvePeriod(query);
    const createdAt = { gte: period.from, lte: period.to };

    const [products, outOfStockCount, orders, stockValueRows, lowStockRows] =
      await Promise.all([
        this.prisma.product.aggregate({
          where: { isActive: true },
          _count: { _all: true },
          _sum: { quantity: true },
        }),
        this.prisma.product.count({ where: { isActive: true, quantity: 0 } }),
        this.prisma.order.aggregate({
          where: { status: { not: OrderStatus.CANCELLED }, createdAt },
          _sum: { totalAmount: true },
          _count: { _all: true },
        }),
        this.prisma.$queryRaw<Array<{ value: unknown }>>`
          SELECT COALESCE(SUM(quantity * COALESCE(cost_price, 0)), 0) AS value
          FROM products
          WHERE is_active = true
        `,
        this.prisma.$queryRaw<Array<{ count: unknown }>>`
          SELECT COUNT(*)::int AS count
          FROM products
          WHERE is_active = true AND quantity <= min_stock
        `,
      ]);

    return {
      totalProducts: products._count._all,
      totalStockUnits: products._sum.quantity ?? 0,
      stockValue: toNumber(stockValueRows[0]?.value),
      lowStockCount: toNumber(lowStockRows[0]?.count),
      outOfStockCount,
      ordersInPeriod: orders._count._all,
      revenueInPeriod: toNumber(orders._sum.totalAmount),
      period: { from: formatDay(period.from), to: formatDay(period.to) },
    };
  }

  /**
   * `GET /dashboard/low-stock` — reuses the tested stock query (raw
   * `quantity <= minStock`, active only) and its role-aware product
   * serialization (AD-004: `costPrice` is ADMIN-only). The dashboard is
   * ADMIN-only anyway, so callers always see `costPrice` here.
   */
  lowStock(
    query: PaginationQueryDto,
    role: string,
  ): Promise<ProductListResponse> {
    return this.stock.lowStock(query as never, role);
  }

  /**
   * `GET /dashboard/sales` — one row per UTC day for the period, zero
   * filled. Cancelled orders are excluded in SQL; `date_trunc` grouping is
   * the part Prisma `groupBy` cannot express, so it is parameterized raw
   * SQL with the two bounds and the cancelled status as bind values.
   */
  async sales(query: DateRangeQueryDto): Promise<SalesDayResponse[]> {
    const period = resolvePeriod(query);

    const rows = await this.prisma.$queryRaw<SalesRow[]>`
      SELECT
        DATE_TRUNC('day', created_at) AS day,
        COALESCE(SUM(total_amount), 0) AS total_sales,
        COUNT(*)::int AS order_count
      FROM orders
      WHERE status::text <> ${OrderStatus.CANCELLED}
        AND created_at >= ${period.from}
        AND created_at <= ${period.to}
      GROUP BY 1
      ORDER BY 1
    `;

    const byDay = new Map(
      rows.map((row) => [formatDay(row.day), row] as const),
    );

    return eachDay(period).map((date) => {
      const row = byDay.get(date);
      return {
        date,
        totalSales: toNumber(row?.total_sales),
        orderCount: toNumber(row?.order_count),
      };
    });
  }

  /**
   * `GET /dashboard/top-products` — best sellers in the period via Prisma
   * `groupBy` on the order items (relation filters cover the parent order's
   * status/date), then one product lookup for names/SKUs. Cancelled orders
   * never contribute.
   */
  async topProducts(query: TopProductsQueryDto): Promise<TopProductResponse[]> {
    const period = resolvePeriod(query);
    const limit = query.limit ?? 5;

    const grouped = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          status: { not: OrderStatus.CANCELLED },
          createdAt: { gte: period.from, lte: period.to },
        },
      },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    if (grouped.length === 0) {
      return [];
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: grouped.map((row) => row.productId) } },
      select: { id: true, name: true, sku: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));

    return grouped.map((row) => {
      const product = byId.get(row.productId);
      return {
        productId: row.productId,
        productName: product?.name ?? '',
        sku: product?.sku ?? '',
        quantitySold: row._sum.quantity ?? 0,
        revenue: toNumber(row._sum.lineTotal),
      };
    });
  }

  /**
   * `GET /dashboard/stock-movements` — daily in/out unit totals for the
   * period, zero filled. `date_trunc` + the `CASE` split again need
   * parameterized raw SQL; the bounds are the only bind values.
   */
  async stockMovements(
    query: DateRangeQueryDto,
  ): Promise<StockMovementDayResponse[]> {
    const period = resolvePeriod(query);

    const rows = await this.prisma.$queryRaw<MovementRow[]>`
      SELECT
        DATE_TRUNC('day', created_at) AS day,
        COALESCE(SUM(CASE WHEN quantity_change > 0 THEN quantity_change ELSE 0 END), 0)::int AS units_in,
        COALESCE(SUM(CASE WHEN quantity_change < 0 THEN -quantity_change ELSE 0 END), 0)::int AS units_out
      FROM stock_movements
      WHERE created_at >= ${period.from}
        AND created_at <= ${period.to}
      GROUP BY 1
      ORDER BY 1
    `;

    const byDay = new Map(
      rows.map((row) => [formatDay(row.day), row] as const),
    );

    return eachDay(period).map((date) => {
      const row = byDay.get(date);
      return {
        date,
        unitsIn: toNumber(row?.units_in),
        unitsOut: toNumber(row?.units_out),
      };
    });
  }
}

/**
 * Validate the optional range: both bounds or neither (default: last 30
 * days inclusive), ordered, and at most `MAX_RANGE_DAYS` long — oversize
 * or inverted ranges are 400s (issue #33).
 */
export function resolvePeriod(query: DateRangeQueryDto): ResolvedPeriod {
  if (!query.from && !query.to) {
    const to = new Date();
    const from = new Date(to.getTime() - 29 * DAY_MS);
    return { from, to };
  }

  if (!query.from || !query.to) {
    throw new BadRequestException('from and to must be provided together');
  }

  const from = new Date(query.from);
  const to = new Date(query.to);

  if (from.getTime() > to.getTime()) {
    throw new BadRequestException('from must be before or equal to to');
  }

  const days = Math.floor((to.getTime() - from.getTime()) / DAY_MS) + 1;
  if (days > MAX_RANGE_DAYS) {
    throw new BadRequestException(
      `Date range must not exceed ${MAX_RANGE_DAYS} days`,
    );
  }

  return { from, to };
}

/** `YYYY-MM-DD` in UTC. */
function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Every UTC day of the period, inclusive. */
function eachDay(period: ResolvedPeriod): string[] {
  const days: string[] = [];
  const cursor = new Date(
    Date.UTC(
      period.from.getUTCFullYear(),
      period.from.getUTCMonth(),
      period.from.getUTCDate(),
    ),
  );
  const last = Date.UTC(
    period.to.getUTCFullYear(),
    period.to.getUTCMonth(),
    period.to.getUTCDate(),
  );

  while (cursor.getTime() <= last) {
    days.push(formatDay(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

/** Raw numeric columns arrive as Decimal/string/bigint — normalize to number. */
function toNumber(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }
  return Number(value);
}
