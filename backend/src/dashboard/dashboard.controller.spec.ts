import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { DateRangeQueryDto } from './dto/date-range.query.dto.js';
import { TopProductsQueryDto } from './dto/top-products.query.dto.js';
import { PaginationQueryDto } from '../common/dto/pagination.query.dto.js';
import { PERMISSIONS_KEY } from '../auth/decorators/require-permission.decorator.js';

const ADMIN = {
  sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'ADMIN',
} as const;

describe('DashboardController', () => {
  let controller: DashboardController;
  let reflector: Reflector;
  const summary = vi.fn();
  const lowStock = vi.fn();
  const sales = vi.fn();
  const topProducts = vi.fn();
  const stockMovements = vi.fn();

  beforeEach(async () => {
    summary.mockReset().mockResolvedValue({});
    lowStock.mockReset().mockResolvedValue({ data: [], meta: {} });
    sales.mockReset().mockResolvedValue([]);
    topProducts.mockReset().mockResolvedValue([]);
    stockMovements.mockReset().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: { summary, lowStock, sales, topProducts, stockMovements },
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
    reflector = module.get(Reflector);
  });

  it('forwards the range to the summary, sales and movements endpoints', async () => {
    const range = {
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-02T00:00:00.000Z',
    } as DateRangeQueryDto;

    await controller.summary(range);
    expect(summary).toHaveBeenCalledWith(range);

    await controller.sales(range);
    expect(sales).toHaveBeenCalledWith(range);

    await controller.stockMovements(range);
    expect(stockMovements).toHaveBeenCalledWith(range);
  });

  it('forwards the limit with the range to top-products', async () => {
    const query = {
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-02T00:00:00.000Z',
      limit: 3,
    } as TopProductsQueryDto;

    await controller.topProducts(query);
    expect(topProducts).toHaveBeenCalledWith(query);
  });

  it('forwards the pagination and role to low-stock', async () => {
    const query = { page: 2, limit: 10 } as PaginationQueryDto;

    await controller.lowStock(query, ADMIN);
    expect(lowStock).toHaveBeenCalledWith(query, 'ADMIN');
  });

  it('is ADMIN-only via dashboard.read on every dashboard route', () => {
    // The guard uses getAllAndOverride(handler, class): the class carries
    // the permission requirement and no handler overrides it.
    expect(
      reflector.get<string[]>(PERMISSIONS_KEY, DashboardController),
    ).toEqual(['dashboard.read']);

    const handlers = [
      DashboardController.prototype.summary,
      DashboardController.prototype.lowStock,
      DashboardController.prototype.sales,
      DashboardController.prototype.topProducts,
      DashboardController.prototype.stockMovements,
    ];

    for (const handler of handlers) {
      expect(reflector.get<string[]>(PERMISSIONS_KEY, handler)).toBeUndefined();
    }
  });

  describe('input validation (400)', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const validateRange = (value: unknown) =>
      pipe.transform(value, { type: 'query', metatype: DateRangeQueryDto });
    const validateTop = (value: unknown) =>
      pipe.transform(value, { type: 'query', metatype: TopProductsQueryDto });
    const validatePagination = (value: unknown) =>
      pipe.transform(value, { type: 'query', metatype: PaginationQueryDto });

    it.each([
      ['a non-date from', { from: 'yesterday' }],
      ['a non-date to', { to: '2026-13-40' }],
      ['an unknown param', { q: 'sales' }],
    ] as const)('rejects %s on the range', async (_name, bad) => {
      await expect(validateRange(bad)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('accepts a valid range and the default 30-day window', async () => {
      await expect(
        validateRange({
          from: '2026-10-01T00:00:00.000Z',
          to: '2026-10-02T00:00:00.000Z',
        }),
      ).resolves.toMatchObject({ from: '2026-10-01T00:00:00.000Z' });
      await expect(validateRange({})).resolves.toEqual({});
    });

    it.each([
      ['a zero limit', { limit: 0 }],
      ['a limit above 50', { limit: 51 }],
      ['a non-integer limit', { limit: 2.5 }],
    ] as const)('rejects %s on top-products', async (_name, bad) => {
      await expect(validateTop(bad)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('accepts the top-products default limit when omitted', async () => {
      await expect(validateTop({})).resolves.toEqual({});
    });

    it.each([
      ['page 0', { page: 0 }],
      ['limit above 100', { limit: 101 }],
      ['a non-integer page', { page: 1.5 }],
    ] as const)('rejects %s on low-stock pagination', async (_name, bad) => {
      await expect(validatePagination(bad)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
