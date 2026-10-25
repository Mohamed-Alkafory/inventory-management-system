import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

import { ReportsService } from './reports.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  Prisma,
  OrderStatus,
  StockMovementType,
} from '../generated/prisma/client.js';
import { type ExportInventoryQueryDto } from './dto/export.query.dto.js';

const MIN_STOCK_REF = { field: 'minStock' } as never;

const productRow = (overrides: Record<string, unknown> = {}) => ({
  sku: 'PEN-1',
  name: 'Ballpoint Pen',
  category: { name: 'Office' },
  supplier: { companyName: 'Office Depot' },
  quantity: 10,
  minStock: 20,
  price: new Prisma.Decimal('1.99'),
  costPrice: new Prisma.Decimal('0.60'),
  isActive: true,
  ...overrides,
});

const orderRow = (overrides: Record<string, unknown> = {}) => ({
  orderNumber: 'ORD-0001',
  status: OrderStatus.PENDING,
  customerName: 'Walk-in',
  customerPhone: null,
  totalAmount: new Prisma.Decimal('3.98'),
  createdAt: new Date('2026-10-02T10:00:00.000Z'),
  createdBy: { name: 'Admin User' },
  _count: { orderItems: 2 },
  ...overrides,
});

const movementRow = (overrides: Record<string, unknown> = {}) => ({
  createdAt: new Date('2026-10-02T10:00:00.000Z'),
  type: StockMovementType.SALE,
  quantityChange: -2,
  quantityAfter: 8,
  reason: null,
  product: { sku: 'PEN-1', name: 'Ballpoint Pen' },
  order: { orderNumber: 'ORD-0001' },
  purchaseOrder: null,
  createdBy: { name: 'Admin User' },
  ...overrides,
});

describe('ReportsService', () => {
  let service: ReportsService;
  const productFindMany = vi.fn();
  const orderFindMany = vi.fn();
  const stockMovementFindMany = vi.fn();

  beforeEach(async () => {
    productFindMany.mockReset().mockResolvedValue([]);
    orderFindMany.mockReset().mockResolvedValue([]);
    stockMovementFindMany.mockReset().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: {
            product: {
              findMany: productFindMany,
              fields: { minStock: MIN_STOCK_REF },
            },
            order: { findMany: orderFindMany },
            stockMovement: { findMany: stockMovementFindMany },
          },
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('inventory', () => {
    it('exports active products by default with a dated filename', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-25T12:00:00.000Z'));
      productFindMany.mockResolvedValue([productRow()]);

      const report = await service.inventory({} as ExportInventoryQueryDto);

      expect(productFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: expect.objectContaining({ sku: true, costPrice: true }),
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      });
      expect(report.filename).toBe('inventory-2026-10-25.csv');
      expect(report.content).toBe(
        [
          'SKU,Name,Category,Supplier,Quantity,Min Stock,Price,Cost Price,Active',
          'PEN-1,Ballpoint Pen,Office,Office Depot,10,20,1.99,0.60,yes',
          '',
        ].join('\r\n'),
      );
    });

    it('applies every list filter, including stock status', async () => {
      await service.inventory({
        search: 'pen',
        categoryId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        supplierId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        isActive: false,
        stockStatus: 'in_stock',
      } as ExportInventoryQueryDto);

      expect(productFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: false,
            OR: [
              { name: { contains: 'pen', mode: 'insensitive' } },
              { sku: { contains: 'pen', mode: 'insensitive' } },
            ],
            categoryId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            supplierId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            quantity: { gt: 0 },
          },
        }),
      );
    });

    it('uses a field reference for the low_stock column comparison', async () => {
      await service.inventory({
        stockStatus: 'low_stock',
      } as ExportInventoryQueryDto);

      expect(productFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, quantity: { lte: MIN_STOCK_REF } },
        }),
      );
    });

    it('filters out_of_stock products', async () => {
      await service.inventory({
        stockStatus: 'out_of_stock',
      } as ExportInventoryQueryDto);

      expect(productFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, quantity: 0 },
        }),
      );
    });

    it('renders empty cost price and supplier for missing values', async () => {
      productFindMany.mockResolvedValue([
        productRow({ costPrice: null, supplier: null, isActive: false }),
      ]);

      const report = await service.inventory({} as ExportInventoryQueryDto);

      expect(report.content).toContain(
        'PEN-1,Ballpoint Pen,Office,,10,20,1.99,,no',
      );
    });
  });

  describe('lowStock', () => {
    it('queries active products at/below minStock with a shortfall column', async () => {
      productFindMany.mockResolvedValue([
        productRow({ quantity: 5, minStock: 20 }),
      ]);

      const report = await service.lowStock();

      expect(productFindMany).toHaveBeenCalledWith({
        where: { isActive: true, quantity: { lte: MIN_STOCK_REF } },
        select: expect.any(Object),
        orderBy: [{ quantity: 'asc' }, { name: 'asc' }],
      });
      expect(report.filename).toMatch(/^low-stock-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(report.content).toBe(
        [
          'SKU,Name,Category,Supplier,Quantity,Min Stock,Shortfall',
          'PEN-1,Ballpoint Pen,Office,Office Depot,5,20,15',
          '',
        ].join('\r\n'),
      );
    });

    it('never reports a negative shortfall', async () => {
      productFindMany.mockResolvedValue([
        productRow({ quantity: 25, minStock: 20 }),
      ]);

      const report = await service.lowStock();

      expect(report.content).toContain(
        'PEN-1,Ballpoint Pen,Office,Office Depot,25,20,0',
      );
    });
  });

  describe('sales', () => {
    it('exports non-cancelled orders in the range', async () => {
      orderFindMany.mockResolvedValue([orderRow()]);

      const report = await service.sales({
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-31T23:59:59.999Z',
      });

      expect(orderFindMany).toHaveBeenCalledWith({
        where: {
          status: { not: OrderStatus.CANCELLED },
          createdAt: {
            gte: new Date('2026-10-01T00:00:00.000Z'),
            lte: new Date('2026-10-31T23:59:59.999Z'),
          },
        },
        select: expect.any(Object),
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      expect(report.filename).toBe('sales-2026-10-01_2026-10-31.csv');
      expect(report.content).toBe(
        [
          'Order Number,Created At,Status,Customer,Phone,Items,Total,Created By',
          'ORD-0001,2026-10-02T10:00:00.000Z,PENDING,Walk-in,,2,3.98,Admin User',
          '',
        ].join('\r\n'),
      );
    });

    it('defaults to the last 30 days and zero rows produces headers only', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-25T12:00:00.000Z'));

      const report = await service.sales({});

      expect(orderFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: { not: OrderStatus.CANCELLED },
            createdAt: {
              gte: new Date('2026-09-26T12:00:00.000Z'),
              lte: new Date('2026-10-25T12:00:00.000Z'),
            },
          },
        }),
      );
      expect(report.filename).toBe('sales-2026-09-26_2026-10-25.csv');
      expect(report.content.split('\r\n')).toHaveLength(2);
    });

    it('rejects an oversized range (dashboard cap)', async () => {
      await expect(
        service.sales({
          from: '2026-01-01T00:00:00.000Z',
          to: '2026-12-31T00:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(orderFindMany).not.toHaveBeenCalled();
    });
  });

  describe('stockMovements', () => {
    it('applies the movement filters and renders joined names', async () => {
      stockMovementFindMany.mockResolvedValue([movementRow()]);

      const report = await service.stockMovements({
        productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        type: StockMovementType.SALE,
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-31T23:59:59.999Z',
      });

      expect(stockMovementFindMany).toHaveBeenCalledWith({
        where: {
          productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          type: StockMovementType.SALE,
          createdAt: {
            gte: new Date('2026-10-01T00:00:00.000Z'),
            lte: new Date('2026-10-31T23:59:59.999Z'),
          },
        },
        select: expect.any(Object),
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      expect(report.filename).toBe('stock-movements-2026-10-01_2026-10-31.csv');
      expect(report.content).toContain(
        '2026-10-02T10:00:00.000Z,PEN-1,Ballpoint Pen,SALE,-2,8,,ORD-0001,,Admin User',
      );
    });

    it('uses the purchase order number and empty optional fields', async () => {
      stockMovementFindMany.mockResolvedValue([
        movementRow({
          type: StockMovementType.PURCHASE_RECEIPT,
          quantityChange: 5,
          reason: 'Received purchase order PO-0001',
          order: null,
          purchaseOrder: { orderNumber: 'PO-0001' },
        }),
      ]);

      const report = await service.stockMovements({});

      expect(report.content).toContain(
        'PURCHASE_RECEIPT,5,8,Received purchase order PO-0001,,PO-0001,Admin User',
      );
      expect(report.filename).toMatch(
        /^stock-movements-\d{4}-\d{2}-\d{2}\.csv$/,
      );
    });

    it('escapes commas in free-text reasons', async () => {
      stockMovementFindMany.mockResolvedValue([
        movementRow({ reason: 'Damaged, returned to supplier' }),
      ]);

      const report = await service.stockMovements({});

      expect(report.content).toContain('"Damaged, returned to supplier"');
    });
  });
});
