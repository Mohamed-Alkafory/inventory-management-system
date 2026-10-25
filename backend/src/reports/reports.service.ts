import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, OrderStatus } from '../generated/prisma/client.js';
import { resolvePeriod } from '../dashboard/dashboard.service.js';
import { type DateRangeQueryDto } from '../dashboard/dto/date-range.query.dto.js';
import {
  type ExportInventoryQueryDto,
  type ExportMovementsQueryDto,
  type ReportStockStatus,
} from './dto/export.query.dto.js';
import { toCsv, type CsvColumn } from './csv.js';

/** A rendered download: filename for `Content-Disposition` + CSV body. */
export interface CsvReport {
  filename: string;
  content: string;
}

const INVENTORY_SELECT = {
  sku: true,
  name: true,
  category: { select: { name: true } },
  supplier: { select: { companyName: true } },
  quantity: true,
  minStock: true,
  price: true,
  costPrice: true,
  isActive: true,
} satisfies Prisma.ProductSelect;

type InventoryRow = Prisma.ProductGetPayload<{
  select: typeof INVENTORY_SELECT;
}>;

const INVENTORY_COLUMNS: CsvColumn<InventoryRow>[] = [
  { header: 'SKU', value: (row) => row.sku },
  { header: 'Name', value: (row) => row.name },
  { header: 'Category', value: (row) => row.category.name },
  { header: 'Supplier', value: (row) => row.supplier?.companyName ?? '' },
  { header: 'Quantity', value: (row) => row.quantity },
  { header: 'Min Stock', value: (row) => row.minStock },
  { header: 'Price', value: (row) => row.price.toFixed(2) },
  { header: 'Cost Price', value: (row) => row.costPrice?.toFixed(2) ?? '' },
  { header: 'Active', value: (row) => (row.isActive ? 'yes' : 'no') },
];

const LOW_STOCK_COLUMNS: CsvColumn<InventoryRow>[] = [
  { header: 'SKU', value: (row) => row.sku },
  { header: 'Name', value: (row) => row.name },
  { header: 'Category', value: (row) => row.category.name },
  { header: 'Supplier', value: (row) => row.supplier?.companyName ?? '' },
  { header: 'Quantity', value: (row) => row.quantity },
  { header: 'Min Stock', value: (row) => row.minStock },
  {
    header: 'Shortfall',
    value: (row) => Math.max(0, row.minStock - row.quantity),
  },
];

const SALES_SELECT = {
  orderNumber: true,
  status: true,
  customerName: true,
  customerPhone: true,
  totalAmount: true,
  createdAt: true,
  createdBy: { select: { name: true } },
  _count: { select: { orderItems: true } },
} satisfies Prisma.OrderSelect;

type SalesRow = Prisma.OrderGetPayload<{ select: typeof SALES_SELECT }>;

const SALES_COLUMNS: CsvColumn<SalesRow>[] = [
  { header: 'Order Number', value: (row) => row.orderNumber },
  { header: 'Created At', value: (row) => row.createdAt },
  { header: 'Status', value: (row) => row.status },
  { header: 'Customer', value: (row) => row.customerName ?? '' },
  { header: 'Phone', value: (row) => row.customerPhone ?? '' },
  { header: 'Items', value: (row) => row._count.orderItems },
  { header: 'Total', value: (row) => row.totalAmount.toFixed(2) },
  { header: 'Created By', value: (row) => row.createdBy.name },
];

const MOVEMENT_SELECT = {
  createdAt: true,
  type: true,
  quantityChange: true,
  quantityAfter: true,
  reason: true,
  product: { select: { sku: true, name: true } },
  order: { select: { orderNumber: true } },
  purchaseOrder: { select: { orderNumber: true } },
  createdBy: { select: { name: true } },
} satisfies Prisma.StockMovementSelect;

type MovementRow = Prisma.StockMovementGetPayload<{
  select: typeof MOVEMENT_SELECT;
}>;

const MOVEMENT_COLUMNS: CsvColumn<MovementRow>[] = [
  { header: 'Created At', value: (row) => row.createdAt },
  { header: 'SKU', value: (row) => row.product.sku },
  { header: 'Product', value: (row) => row.product.name },
  { header: 'Type', value: (row) => row.type },
  { header: 'Change', value: (row) => row.quantityChange },
  { header: 'Quantity After', value: (row) => row.quantityAfter },
  { header: 'Reason', value: (row) => row.reason ?? '' },
  { header: 'Order Number', value: (row) => row.order?.orderNumber ?? '' },
  {
    header: 'Purchase Order Number',
    value: (row) => row.purchaseOrder?.orderNumber ?? '',
  },
  { header: 'Created By', value: (row) => row.createdBy.name },
];

/**
 * CSV report exports (issue #55). All reports are **ADMIN-only** and reuse
 * the same filters as the existing list endpoints; they export every match
 * (no pagination) and are read-only. Contents are rendered server-side with
 * `toCsv`, so headers, escaping and the download filename are guaranteed for
 * every report. Documented in contract §3.13 / AD-012.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** `GET /reports/inventory.csv` — active products by default. */
  async inventory(query: ExportInventoryQueryDto): Promise<CsvReport> {
    const rows = await this.prisma.product.findMany({
      where: {
        isActive: query.isActive ?? true,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { sku: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.supplierId ? { supplierId: query.supplierId } : {}),
        ...this.stockStatusWhere(query.stockStatus),
      },
      select: INVENTORY_SELECT,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    return {
      filename: `inventory-${today()}.csv`,
      content: toCsv(INVENTORY_COLUMNS, rows),
    };
  }

  /** `GET /reports/low-stock.csv` — active products at/below `minStock`. */
  async lowStock(): Promise<CsvReport> {
    const rows = await this.prisma.product.findMany({
      where: {
        isActive: true,
        ...this.stockStatusWhere('low_stock'),
      },
      select: INVENTORY_SELECT,
      orderBy: [{ quantity: 'asc' }, { name: 'asc' }],
    });

    return {
      filename: `low-stock-${today()}.csv`,
      content: toCsv(LOW_STOCK_COLUMNS, rows),
    };
  }

  /**
   * `GET /reports/sales.csv?from&to` — non-cancelled orders in the period.
   * The range is resolved/validated exactly like the dashboard (default last
   * 30 days, at most 92 days, 400 otherwise).
   */
  async sales(query: DateRangeQueryDto): Promise<CsvReport> {
    const period = resolvePeriod(query);

    const rows = await this.prisma.order.findMany({
      where: {
        status: { not: OrderStatus.CANCELLED },
        createdAt: { gte: period.from, lte: period.to },
      },
      select: SALES_SELECT,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return {
      filename: `sales-${day(period.from)}_${day(period.to)}.csv`,
      content: toCsv(SALES_COLUMNS, rows),
    };
  }

  /**
   * `GET /reports/stock-movements.csv` — movement history using the same
   * `productId`/`type`/`orderId`/`purchaseOrderId`/date filters as
   * `GET /stock/movements`.
   */
  async stockMovements(query: ExportMovementsQueryDto): Promise<CsvReport> {
    const rows = await this.prisma.stockMovement.findMany({
      where: {
        ...(query.productId ? { productId: query.productId } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.orderId ? { orderId: query.orderId } : {}),
        ...(query.purchaseOrderId
          ? { purchaseOrderId: query.purchaseOrderId }
          : {}),
        ...(query.from || query.to
          ? {
              createdAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      select: MOVEMENT_SELECT,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const span =
      query.from || query.to
        ? `${query.from ? day(new Date(query.from)) : 'start'}_${
            query.to ? day(new Date(query.to)) : 'end'
          }`
        : today();

    return {
      filename: `stock-movements-${span}.csv`,
      content: toCsv(MOVEMENT_COLUMNS, rows),
    };
  }

  /**
   * `stockStatus` maps to the `/products` semantics. `low_stock` compares two
   * columns (`quantity <= minStock`), expressed with a Prisma field reference
   * instead of raw SQL.
   */
  private stockStatusWhere(
    status: ReportStockStatus | undefined,
  ): Prisma.ProductWhereInput {
    switch (status) {
      case 'in_stock':
        return { quantity: { gt: 0 } };
      case 'out_of_stock':
        return { quantity: 0 };
      case 'low_stock':
        return { quantity: { lte: this.prisma.product.fields.minStock } };
      default:
        return {};
    }
  }
}

/** `YYYY-MM-DD` in UTC. */
function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function today(): string {
  return day(new Date());
}
