import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, OrderStatus } from '../generated/prisma/client.js';
import { StockService } from '../stock/stock.service.js';
import {
  DashboardService,
  MAX_RANGE_DAYS,
  resolvePeriod,
} from './dashboard.service.js';
import { type TopProductsQueryDto } from './dto/top-products.query.dto.js';

const role = 'ADMIN';

describe('DashboardService', () => {
  let service: DashboardService;
  const productAggregate = vi.fn();
  const productCount = vi.fn();
  const orderAggregate = vi.fn();
  const orderItemGroupBy = vi.fn();
  const productFindMany = vi.fn();
  const $queryRaw = vi.fn();
  const lowStock = vi.fn();

  /** Raw-SQL rows each dashboard query should receive. */
  let stockValueRows: Array<{ value: unknown }>;
  let lowStockRows: Array<{ count: unknown }>;
  let salesRows: Array<Record<string, unknown>>;
  let movementRows: Array<Record<string, unknown>>;

  beforeEach(async () => {
    productAggregate.mockReset().mockResolvedValue({
      _count: { _all: 12 },
      _sum: { quantity: 340 },
    });
    productCount.mockReset().mockResolvedValue(2);
    orderAggregate.mockReset().mockResolvedValue({
      _sum: { totalAmount: new Prisma.Decimal('1234.50') },
      _count: { _all: 18 },
    });
    orderItemGroupBy.mockReset().mockResolvedValue([]);
    productFindMany.mockReset().mockResolvedValue([]);
    lowStock.mockReset().mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    stockValueRows = [{ value: '987.65' }];
    lowStockRows = [{ count: 4 }];
    salesRows = [];
    movementRows = [];

    $queryRaw
      .mockReset()
      .mockImplementation((strings: TemplateStringsArray) => {
        const sql = strings.join('?');
        if (sql.includes('SUM(quantity * COALESCE(cost_price')) {
          return Promise.resolve(stockValueRows);
        }
        if (sql.includes('quantity <= min_stock')) {
          return Promise.resolve(lowStockRows);
        }
        if (sql.includes('FROM orders')) {
          return Promise.resolve(salesRows);
        }
        if (sql.includes('FROM stock_movements')) {
          return Promise.resolve(movementRows);
        }
        return Promise.resolve([]);
      });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: {
            product: {
              aggregate: productAggregate,
              count: productCount,
              findMany: productFindMany,
            },
            order: { aggregate: orderAggregate },
            orderItem: { groupBy: orderItemGroupBy },
            $queryRaw,
          },
        },
        { provide: StockService, useValue: { lowStock } },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('resolvePeriod — defaults and the 92-day cap (#33)', () => {
    it('defaults to the last 30 days inclusive', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-25T12:00:00.000Z'));

      const period = resolvePeriod({});

      expect(period.to.toISOString()).toBe('2026-10-25T12:00:00.000Z');
      expect(period.from.toISOString()).toBe('2026-09-26T12:00:00.000Z');
    });

    it('rejects a range with only one bound', () => {
      expect(() => resolvePeriod({ from: '2026-10-01T00:00:00.000Z' })).toThrow(
        BadRequestException,
      );
      expect(() => resolvePeriod({ to: '2026-10-01T00:00:00.000Z' })).toThrow(
        BadRequestException,
      );
    });

    it('rejects an inverted range', () => {
      expect(() =>
        resolvePeriod({
          from: '2026-10-10T00:00:00.000Z',
          to: '2026-10-01T00:00:00.000Z',
        }),
      ).toThrow(BadRequestException);
    });

    it(`allows exactly ${MAX_RANGE_DAYS} days and rejects one more`, () => {
      expect(() =>
        resolvePeriod({
          from: '2026-01-01T00:00:00.000Z',
          to: '2026-04-02T00:00:00.000Z', // 92 days inclusive
        }),
      ).not.toThrow();

      expect(() =>
        resolvePeriod({
          from: '2026-01-01T00:00:00.000Z',
          to: '2026-04-03T00:00:00.000Z', // 93 days
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('summary', () => {
    it('maps aggregates, column math and the period', async () => {
      const result = await service.summary({
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-25T00:00:00.000Z',
      });

      expect(productAggregate).toHaveBeenCalledWith({
        where: { isActive: true },
        _count: { _all: true },
        _sum: { quantity: true },
      });
      expect(productCount).toHaveBeenCalledWith({
        where: { isActive: true, quantity: 0 },
      });
      expect(orderAggregate).toHaveBeenCalledWith({
        where: {
          status: { not: OrderStatus.CANCELLED },
          createdAt: {
            gte: new Date('2026-10-01T00:00:00.000Z'),
            lte: new Date('2026-10-25T00:00:00.000Z'),
          },
        },
        _sum: { totalAmount: true },
        _count: { _all: true },
      });
      expect(result).toEqual({
        totalProducts: 12,
        totalStockUnits: 340,
        stockValue: 987.65,
        lowStockCount: 4,
        outOfStockCount: 2,
        ordersInPeriod: 18,
        revenueInPeriod: 1234.5,
        period: { from: '2026-10-01', to: '2026-10-25' },
      });
    });

    it('returns zeros for an empty database', async () => {
      productAggregate.mockResolvedValue({
        _count: { _all: 0 },
        _sum: { quantity: null },
      });
      productCount.mockResolvedValue(0);
      orderAggregate.mockResolvedValue({
        _sum: { totalAmount: null },
        _count: { _all: 0 },
      });
      stockValueRows = [{ value: '0' }];
      lowStockRows = [{ count: 0 }];

      const result = await service.summary({
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-01T00:00:00.000Z',
      });

      expect(result.totalStockUnits).toBe(0);
      expect(result.stockValue).toBe(0);
      expect(result.lowStockCount).toBe(0);
      expect(result.revenueInPeriod).toBe(0);
      expect(result.ordersInPeriod).toBe(0);
    });

    it('computes stock value on the cost basis and counts low stock with column math', async () => {
      await service.summary({});

      const sqlStatements = $queryRaw.mock.calls.map(([strings]) =>
        (strings as TemplateStringsArray).join(''),
      );
      expect(
        sqlStatements.some((sql) =>
          sql.includes('quantity * COALESCE(cost_price, 0)'),
        ),
      ).toBe(true);
      expect(
        sqlStatements.some((sql) => sql.includes('quantity <= min_stock')),
      ).toBe(true);
      // Active-only filters, no user input bound into either statement.
      expect(
        $queryRaw.mock.calls.every(([, ...values]) => values.length === 0),
      ).toBe(true);
    });
  });

  describe('lowStock', () => {
    it('delegates to the shared stock query with the requester role', async () => {
      const query = { page: 2, limit: 10 };
      await service.lowStock(query as never, role);

      expect(lowStock).toHaveBeenCalledWith(query, role);
    });
  });

  describe('sales', () => {
    it('zero fills every UTC day and normalizes the aggregates', async () => {
      salesRows = [
        {
          day: new Date('2026-10-02T00:00:00.000Z'),
          total_sales: new Prisma.Decimal('120.00'),
          order_count: 3,
        },
        {
          day: new Date('2026-10-04T00:00:00.000Z'),
          total_sales: '45.50',
          order_count: BigInt(1),
        },
      ];

      const result = await service.sales({
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-04T00:00:00.000Z',
      });

      expect(result).toEqual([
        { date: '2026-10-01', totalSales: 0, orderCount: 0 },
        { date: '2026-10-02', totalSales: 120, orderCount: 3 },
        { date: '2026-10-03', totalSales: 0, orderCount: 0 },
        { date: '2026-10-04', totalSales: 45.5, orderCount: 1 },
      ]);
    });

    it('returns a zero-filled series for an empty period (no errors)', async () => {
      const result = await service.sales({
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-03T00:00:00.000Z',
      });

      expect(result).toHaveLength(3);
      expect(
        result.every((day) => day.totalSales === 0 && day.orderCount === 0),
      ).toBe(true);
    });

    it('excludes cancelled orders via a bound parameter and binds the range', async () => {
      const from = '2026-10-01T00:00:00.000Z';
      const to = '2026-10-02T00:00:00.000Z';
      await service.sales({ from, to });

      const [strings, ...values] = $queryRaw.mock.calls[0];
      const sql = (strings as TemplateStringsArray).join('?');
      expect(sql).toContain("DATE_TRUNC('day', created_at)");
      expect(sql).toContain('status::text <> ?');
      expect(values).toEqual([
        OrderStatus.CANCELLED,
        new Date(from),
        new Date(to),
      ]);
    });
  });

  describe('topProducts', () => {
    it('groups sold lines, enriches product names and applies the default limit', async () => {
      orderItemGroupBy.mockResolvedValue([
        {
          productId: 'p1',
          _sum: { quantity: 30, lineTotal: new Prisma.Decimal('59.70') },
        },
        {
          productId: 'p2',
          _sum: { quantity: 10, lineTotal: new Prisma.Decimal('15.00') },
        },
      ]);
      productFindMany.mockResolvedValue([
        { id: 'p1', name: 'Ballpoint Pen', sku: 'OFF-PEN-002' },
        { id: 'p2', name: 'A4 Paper', sku: 'PAP-A4-001' },
      ]);

      const result = await service.topProducts({
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-25T00:00:00.000Z',
      } as TopProductsQueryDto);

      expect(orderItemGroupBy).toHaveBeenCalledWith({
        by: ['productId'],
        where: {
          order: {
            status: { not: OrderStatus.CANCELLED },
            createdAt: {
              gte: new Date('2026-10-01T00:00:00.000Z'),
              lte: new Date('2026-10-25T00:00:00.000Z'),
            },
          },
        },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      });
      expect(productFindMany).toHaveBeenCalledWith({
        where: { id: { in: ['p1', 'p2'] } },
        select: { id: true, name: true, sku: true },
      });
      expect(result).toEqual([
        {
          productId: 'p1',
          productName: 'Ballpoint Pen',
          sku: 'OFF-PEN-002',
          quantitySold: 30,
          revenue: 59.7,
        },
        {
          productId: 'p2',
          productName: 'A4 Paper',
          sku: 'PAP-A4-001',
          quantitySold: 10,
          revenue: 15,
        },
      ]);
    });

    it('honors a custom limit', async () => {
      await service.topProducts({
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-02T00:00:00.000Z',
        limit: 3,
      } as TopProductsQueryDto);

      expect(orderItemGroupBy).toHaveBeenCalledWith(
        expect.objectContaining({ take: 3 }),
      );
    });

    it('returns an empty array without a product lookup for an empty period', async () => {
      const result = await service.topProducts({});

      expect(result).toEqual([]);
      expect(productFindMany).not.toHaveBeenCalled();
    });
  });

  describe('stockMovements', () => {
    it('zero fills days and splits positive/negative movements', async () => {
      movementRows = [
        {
          day: new Date('2026-10-01T00:00:00.000Z'),
          units_in: 25,
          units_out: BigInt(7),
        },
      ];

      const result = await service.stockMovements({
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-03T00:00:00.000Z',
      });

      expect(result).toEqual([
        { date: '2026-10-01', unitsIn: 25, unitsOut: 7 },
        { date: '2026-10-02', unitsIn: 0, unitsOut: 0 },
        { date: '2026-10-03', unitsIn: 0, unitsOut: 0 },
      ]);
    });

    it('binds the range into the parameterized query', async () => {
      const from = '2026-10-01T00:00:00.000Z';
      const to = '2026-10-02T00:00:00.000Z';
      await service.stockMovements({ from, to });

      const [strings, ...values] = $queryRaw.mock.calls[0];
      const sql = (strings as TemplateStringsArray).join('?');
      expect(sql).toContain('CASE WHEN quantity_change > 0');
      expect(sql).toContain('created_at >= ?');
      expect(values).toEqual([new Date(from), new Date(to)]);
    });

    it('returns zeros for an empty database', async () => {
      const result = await service.stockMovements({
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-01T00:00:00.000Z',
      });

      expect(result).toEqual([{ date: '2026-10-01', unitsIn: 0, unitsOut: 0 }]);
    });
  });
});
