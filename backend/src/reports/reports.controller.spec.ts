import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Response } from 'express';

import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import {
  ExportInventoryQueryDto,
  ExportMovementsQueryDto,
} from './dto/export.query.dto.js';
import { DateRangeQueryDto } from '../dashboard/dto/date-range.query.dto.js';
import { PERMISSIONS_KEY } from '../auth/decorators/require-permission.decorator.js';

const report = {
  filename: 'inventory-2026-10-25.csv',
  content: 'SKU\r\nPEN-1\r\n',
};

describe('ReportsController', () => {
  let controller: ReportsController;
  let reflector: Reflector;
  const inventory = vi.fn();
  const lowStock = vi.fn();
  const sales = vi.fn();
  const stockMovements = vi.fn();
  let res: Response;
  let setHeader: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    inventory.mockReset().mockResolvedValue(report);
    lowStock.mockReset().mockResolvedValue(report);
    sales.mockReset().mockResolvedValue(report);
    stockMovements.mockReset().mockResolvedValue(report);
    setHeader = vi.fn();
    res = { setHeader } as unknown as Response;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: { inventory, lowStock, sales, stockMovements },
        },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
    reflector = module.get(Reflector);
  });

  it('is ADMIN-only via reports.read on the whole controller', () => {
    expect(reflector.get<string[]>(PERMISSIONS_KEY, ReportsController)).toEqual([
      'reports.read',
    ]);
    for (const handler of [
      ReportsController.prototype.inventory,
      ReportsController.prototype.lowStock,
      ReportsController.prototype.sales,
      ReportsController.prototype.stockMovements,
    ]) {
      expect(reflector.get<string[]>(PERMISSIONS_KEY, handler)).toBeUndefined();
    }
  });

  it('forwards the inventory filters and sets download headers', async () => {
    const query = {
      search: 'pen',
      stockStatus: 'low_stock',
    } as ExportInventoryQueryDto;

    await expect(controller.inventory(query, res)).resolves.toBe(
      report.content,
    );

    expect(inventory).toHaveBeenCalledWith(query);
    expect(setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/csv; charset=utf-8',
    );
    expect(setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="inventory-2026-10-25.csv"',
    );
  });

  it('exports low-stock with the attachment filename', async () => {
    await expect(controller.lowStock(res)).resolves.toBe(report.content);

    expect(lowStock).toHaveBeenCalledWith();
    expect(setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="inventory-2026-10-25.csv"',
    );
  });

  it('forwards the sales range', async () => {
    const query = {
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-31T23:59:59.999Z',
    } as DateRangeQueryDto;

    await expect(controller.sales(query, res)).resolves.toBe(report.content);

    expect(sales).toHaveBeenCalledWith(query);
  });

  it('forwards the movement filters', async () => {
    const query = {
      type: 'SALE',
      productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    } as ExportMovementsQueryDto;

    await expect(controller.stockMovements(query, res)).resolves.toBe(
      report.content,
    );

    expect(stockMovements).toHaveBeenCalledWith(query);
  });

  describe('input validation (400)', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const inventoryQuery = (value: unknown) =>
      pipe.transform(value, {
        type: 'query',
        metatype: ExportInventoryQueryDto,
      });
    const movementQuery = (value: unknown) =>
      pipe.transform(value, {
        type: 'query',
        metatype: ExportMovementsQueryDto,
      });
    const salesQuery = (value: unknown) =>
      pipe.transform(value, { type: 'query', metatype: DateRangeQueryDto });

    it('accepts valid inventory filters', async () => {
      await expect(
        inventoryQuery({
          search: 'pen',
          isActive: 'false',
          categoryId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        }),
      ).resolves.toMatchObject({ search: 'pen', isActive: false });
    });

    it.each([
      ['a non-uuid categoryId', { categoryId: 'nope' }],
      ['an unsupported stockStatus', { stockStatus: 'plenty' }],
      ['an unknown filter', { page: 2 }],
    ] as const)('rejects %s on inventory', async (_name, bad) => {
      await expect(inventoryQuery(bad)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it.each([
      ['a non-uuid productId', { productId: 'nope' }],
      ['an unsupported type', { type: 'SOLD' }],
      ['a non-date from', { from: 'yesterday' }],
      ['an unknown filter', { sortBy: 'name' }],
    ] as const)('rejects %s on stock movements', async (_name, bad) => {
      await expect(movementQuery(bad)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects an invalid sales range', async () => {
      await expect(salesQuery({ from: 'yesterday' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('accepts an omitted sales range (defaults server-side)', async () => {
      await expect(salesQuery({})).resolves.toEqual({});
    });
  });
});
