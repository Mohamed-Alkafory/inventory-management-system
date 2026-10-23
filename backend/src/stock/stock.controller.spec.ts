import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  NotFoundException,
  UnprocessableEntityException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { StockController } from './stock.controller.js';
import { ProductMovementsController } from './product-movements.controller.js';
import {
  StockService,
  type AdjustedStockResponse,
  type MovementListResponse,
} from './stock.service.js';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto.js';
import { ListMovementsQueryDto } from './dto/list-movements.query.dto.js';
import { StockMovementType } from '../generated/prisma/enums.js';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';

const ADMIN = { sub: 'admin-id', role: 'ADMIN' } as const;
const STAFF = { sub: 'staff-id', role: 'STAFF' } as const;

const PRODUCT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const sampleMovement = {
  id: '11111111-1111-4111-8111-111111111111',
  productId: PRODUCT_ID,
  type: StockMovementType.ADJUSTMENT,
  quantityChange: -5,
  quantityAfter: 495,
  reason: 'Damaged items removed',
  orderId: null,
  purchaseOrderId: null,
  createdById: USER_ID,
  createdAt: new Date('2026-10-23T12:00:00Z'),
};

const samplePage: MovementListResponse = {
  data: [sampleMovement],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

const sampleAdjustment: AdjustedStockResponse = {
  movement: sampleMovement,
  product: {
    id: PRODUCT_ID,
    sku: 'OFF-PEN-002',
    name: 'Ballpoint Pen',
    quantity: 495,
  } as never,
};

describe('StockController / ProductMovementsController', () => {
  let stockController: StockController;
  let productMovementsController: ProductMovementsController;
  let reflector: Reflector;
  const findAll = vi.fn();
  const adjust = vi.fn();
  const lowStock = vi.fn();
  const findForProduct = vi.fn();

  beforeEach(async () => {
    findAll.mockReset().mockResolvedValue(samplePage);
    adjust.mockReset().mockResolvedValue(sampleAdjustment);
    lowStock.mockReset().mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    findForProduct.mockReset().mockResolvedValue(samplePage);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockController, ProductMovementsController],
      providers: [
        {
          provide: StockService,
          useValue: { findAll, adjust, lowStock, findForProduct },
        },
      ],
    }).compile();

    stockController = module.get<StockController>(StockController);
    productMovementsController = module.get<ProductMovementsController>(
      ProductMovementsController,
    );
    reflector = module.get(Reflector);
  });

  it('lists movements through the service (any role)', async () => {
    const query = {
      page: 2,
      limit: 10,
      type: StockMovementType.ADJUSTMENT,
    } as ListMovementsQueryDto;

    await expect(stockController.findAll(query)).resolves.toEqual(samplePage);
    expect(findAll).toHaveBeenCalledWith(query);
  });

  it('applies an adjustment for the signed-in user and returns { movement, product }', async () => {
    const dto = {
      productId: PRODUCT_ID,
      quantityChange: -5,
      reason: 'Damaged items removed',
    };

    await expect(stockController.adjust(dto as never, ADMIN)).resolves.toEqual(
      sampleAdjustment,
    );
    expect(adjust).toHaveBeenCalledWith(dto, 'admin-id', 'ADMIN');
  });

  it('passes the requester role to the adjustment (STAFF included)', async () => {
    const dto = { productId: PRODUCT_ID, quantityChange: 3, reason: 'restock' };

    await stockController.adjust(dto as never, STAFF);

    expect(adjust).toHaveBeenCalledWith(dto, 'staff-id', 'STAFF');
  });

  it('forwards the low-stock query and requester role', async () => {
    const query = { page: 2, limit: 50 } as ListMovementsQueryDto;

    await stockController.lowStock(query, STAFF);

    expect(lowStock).toHaveBeenCalledWith(query, 'STAFF');
  });

  it("lists one product's movements forced to the path id", async () => {
    const query = { page: 1 } as ListMovementsQueryDto;

    await expect(
      productMovementsController.findAll(PRODUCT_ID, query),
    ).resolves.toEqual(samplePage);
    expect(findForProduct).toHaveBeenCalledWith(PRODUCT_ID, query);
  });

  it('requires no @Roles anywhere in the stock module (STAFF may adjust)', () => {
    const rolesFor = (handler: (...args: never[]) => unknown) =>
      reflector.get<string[]>(ROLES_KEY, handler) ?? [];

    expect(rolesFor(StockController.prototype.findAll)).toEqual([]);
    expect(rolesFor(StockController.prototype.adjust)).toEqual([]);
    expect(rolesFor(StockController.prototype.lowStock)).toEqual([]);
    expect(rolesFor(ProductMovementsController.prototype.findAll)).toEqual([]);
  });

  it('uses the documented status codes', () => {
    const codeOf = (handler: (...args: never[]) => unknown) =>
      Reflect.getMetadata('__httpCode__', handler) ?? HttpStatus.OK;

    // Defaults: GET → 200, POST → 201 (no explicit metadata on POST).
    expect(codeOf(StockController.prototype.findAll)).toBe(HttpStatus.OK);
    expect(codeOf(StockController.prototype.lowStock)).toBe(HttpStatus.OK);
    expect(
      Reflect.getMetadata('__httpCode__', StockController.prototype.adjust),
    ).toBeUndefined();
  });

  it('propagates the service 404/409/422 for adjustment failures', async () => {
    adjust
      .mockRejectedValueOnce(
        new NotFoundException(`Product ${PRODUCT_ID} not found`),
      )
      .mockRejectedValueOnce(new ConflictException('Insufficient stock'))
      .mockRejectedValueOnce(
        new UnprocessableEntityException(`Product ${PRODUCT_ID} is inactive`),
      );

    await expect(
      stockController.adjust({} as never, ADMIN),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      stockController.adjust({} as never, ADMIN),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      stockController.adjust({} as never, ADMIN),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('propagates the 404 for a missing product movements history', async () => {
    findForProduct.mockRejectedValue(
      new NotFoundException(`Product ${PRODUCT_ID} not found`),
    );

    await expect(
      productMovementsController.findAll(PRODUCT_ID, {} as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('input validation (400) — adjustment body', () => {
    // The global ValidationPipe whitelist/forbidNonWhitelisted config in main.ts.
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    const validate = (value: unknown) =>
      pipe.transform(value, { type: 'body', metatype: CreateAdjustmentDto });

    it('rejects a body without productId, quantityChange or reason', async () => {
      await expect(validate({ reason: 'shelf check' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects a non-UUID productId', async () => {
      await expect(
        validate({ productId: 'not-a-uuid', quantityChange: 1, reason: 'x' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects quantityChange = 0 as a 400 field error (a neutral change is noise)', async () => {
      await expect(
        validate({
          productId: PRODUCT_ID,
          quantityChange: 0,
          reason: 'nothing',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects non-integer / non-numeric quantityChange', async () => {
      await expect(
        validate({ productId: PRODUCT_ID, quantityChange: 1.5, reason: 'x' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        validate({
          productId: PRODUCT_ID,
          quantityChange: 'five',
          reason: 'x',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an empty or over-long reason', async () => {
      await expect(
        validate({ productId: PRODUCT_ID, quantityChange: 1, reason: '' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        validate({
          productId: PRODUCT_ID,
          quantityChange: 1,
          reason: 'a'.repeat(501),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects unknown (non-whitelisted) fields, e.g. a client-sent quantityAfter', async () => {
      await expect(
        validate({
          productId: PRODUCT_ID,
          quantityChange: -5,
          reason: 'Damaged items removed',
          quantityAfter: 495,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a valid stock-in and stock-out body', async () => {
      await expect(
        validate({
          productId: PRODUCT_ID,
          quantityChange: -5,
          reason: 'Damaged items removed',
        }),
      ).resolves.toMatchObject({ quantityChange: -5 });
      await expect(
        validate({
          productId: PRODUCT_ID,
          quantityChange: 25,
          reason: 'restock box',
        }),
      ).resolves.toMatchObject({ quantityChange: 25 });
    });
  });

  describe('input validation (400) — movement query params', () => {
    // Mirrors the global ValidationPipe settings, including ?page=1.
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const validate = (value: unknown) =>
      pipe.transform(value, { type: 'query', metatype: ListMovementsQueryDto });

    it.each([
      ['page below 1', { page: 0 }],
      ['non-numeric page', { page: 'first' }],
      ['limit above 100', { limit: 101 }],
      ['non-integer limit', { limit: 2.5 }],
      ['non-UUID productId', { productId: 'not-a-uuid' }],
      ['invalid type', { type: 'MAGIC' }],
      ['non-UUID orderId', { orderId: 'not-a-uuid' }],
      ['non-UUID purchaseOrderId', { purchaseOrderId: 'not-a-uuid' }],
      ['non-date from', { from: 'sometime' }],
      ['non-date to', { to: 'yesterday' }],
      ['invalid sortBy', { sortBy: 'product' }],
      ['invalid sortOrder', { sortOrder: 'up' }],
      ['unknown non-whitelisted param', { q: 'pen' }],
    ] as const)('rejects %s with 400', async (_name, bad) => {
      await expect(validate(bad)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a valid query and applies defaults', async () => {
      const transformed = await validate({
        type: 'ADJUSTMENT',
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-23T23:59:59.999Z',
      });

      expect(transformed).toMatchObject({
        type: StockMovementType.ADJUSTMENT,
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-23T23:59:59.999Z',
        page: 1,
        limit: 20,
      });
    });
  });
});
