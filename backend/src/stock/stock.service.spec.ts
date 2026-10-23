import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, StockMovementType } from '../generated/prisma/client.js';
import { ProductsService } from '../products/products.service.js';
import { type CreateAdjustmentDto } from './dto/create-adjustment.dto.js';
import { type ListMovementsQueryDto } from './dto/list-movements.query.dto.js';
import { StockService } from './stock.service.js';

const ADJUSTMENT_DTO: CreateAdjustmentDto = {
  productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  quantityChange: -5,
  reason: 'Damaged items removed',
} as never;

const USER_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

describe('StockService', () => {
  let service: StockService;
  const $transaction = vi.fn();
  const txProductUpdateMany = vi.fn();
  const txProductFindUnique = vi.fn();
  const txStockMovementCreate = vi.fn();
  const stockMovementCount = vi.fn();
  const stockMovementFindMany = vi.fn();
  const productFindUnique = vi.fn();
  const productsFindAll = vi.fn();

  const productRow = (overrides: Record<string, unknown> = {}) => {
    const row: Record<string, unknown> = {
      id: ADJUSTMENT_DTO.productId,
      sku: 'OFF-PEN-002',
      name: 'Ballpoint Pen',
      description: null,
      imageUrl: null,
      barcode: null,
      price: new Prisma.Decimal('1.99'),
      costPrice: new Prisma.Decimal('0.60'),
      quantity: 495,
      minStock: 50,
      isActive: true,
      categoryId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      supplierId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      createdAt: new Date('2026-10-15T00:00:00Z'),
      updatedAt: new Date('2026-10-15T00:00:00Z'),
    };
    return { ...row, ...overrides };
  };

  const movementRow = (overrides: Record<string, unknown> = {}) => {
    const row: Record<string, unknown> = {
      id: '11111111-1111-4111-8111-111111111111',
      productId: ADJUSTMENT_DTO.productId,
      type: StockMovementType.ADJUSTMENT,
      quantityChange: -5,
      quantityAfter: 495,
      reason: 'Damaged items removed',
      orderId: null,
      purchaseOrderId: null,
      createdById: USER_ID,
      createdAt: new Date('2026-10-23T12:00:00Z'),
    };
    return { ...row, ...overrides };
  };

  /** The transaction client handed to $transaction callbacks. */
  const tx = {
    product: {
      updateMany: txProductUpdateMany,
      findUnique: txProductFindUnique,
    },
    stockMovement: { create: txStockMovementCreate },
  };

  beforeEach(async () => {
    $transaction
      .mockReset()
      .mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
    txProductUpdateMany.mockReset().mockResolvedValue({ count: 1 });
    txProductFindUnique.mockReset().mockResolvedValue(productRow());
    txStockMovementCreate.mockReset().mockResolvedValue(movementRow());
    stockMovementCount.mockReset().mockResolvedValue(0);
    stockMovementFindMany.mockReset().mockResolvedValue([]);
    productFindUnique
      .mockReset()
      .mockResolvedValue({ id: ADJUSTMENT_DTO.productId });
    productsFindAll.mockReset().mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        {
          provide: PrismaService,
          useValue: {
            $transaction,
            stockMovement: {
              count: stockMovementCount,
              findMany: stockMovementFindMany,
            },
            product: { findUnique: productFindUnique },
          },
        },
        { provide: ProductsService, useValue: { findAll: productsFindAll } },
      ],
    }).compile();

    service = module.get<StockService>(StockService);
  });

  describe('adjust — one Serializable transaction, atomic write', () => {
    it('runs the stock write in a Serializable transaction', async () => {
      await service.adjust(ADJUSTMENT_DTO, USER_ID, 'ADMIN');

      expect($transaction).toHaveBeenCalledTimes(1);
      expect($transaction.mock.calls[0][1]).toEqual({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    });

    it('uses one atomic conditional decrement guarded by the current quantity', async () => {
      await service.adjust(ADJUSTMENT_DTO, USER_ID, 'ADMIN');

      expect(txProductUpdateMany).toHaveBeenCalledWith({
        // 5 units out: row must hold >= 5 (no read-then-write race).
        where: {
          id: ADJUSTMENT_DTO.productId,
          isActive: true,
          quantity: { gte: 5 },
        },
        data: { quantity: { increment: -5 } },
      });
    });

    it('increments without a quantity guard for stock-in changes', async () => {
      await service.adjust(
        { ...ADJUSTMENT_DTO, quantityChange: 12 } as never,
        USER_ID,
        'ADMIN',
      );

      expect(txProductUpdateMany).toHaveBeenCalledWith({
        where: { id: ADJUSTMENT_DTO.productId, isActive: true },
        data: { quantity: { increment: 12 } },
      });
    });

    it('returns the movement and the serialized product', async () => {
      const result = await service.adjust(ADJUSTMENT_DTO, USER_ID, 'ADMIN');

      expect(txStockMovementCreate).toHaveBeenCalledWith({
        data: {
          productId: ADJUSTMENT_DTO.productId,
          type: StockMovementType.ADJUSTMENT,
          quantityChange: -5,
          quantityAfter: 495,
          reason: 'Damaged items removed',
          orderId: undefined,
          purchaseOrderId: undefined,
          createdById: USER_ID,
        },
        select: expect.objectContaining({ id: true, quantityAfter: true }),
      });
      expect(result.movement).toEqual(movementRow());
      // ADMIN sees costPrice (AD-004); prices are numbers.
      expect(result.product).toMatchObject({
        id: ADJUSTMENT_DTO.productId,
        price: 1.99,
        costPrice: 0.6,
        quantity: 495,
      });
    });

    it('omits costPrice for STAFF (AD-004)', async () => {
      const result = await service.adjust(ADJUSTMENT_DTO, USER_ID, 'STAFF');

      expect(result.product).not.toHaveProperty('costPrice');
    });

    it('rejects with 409 when the stock would go below zero — nothing written', async () => {
      txProductUpdateMany.mockResolvedValue({ count: 0 });
      txProductFindUnique.mockResolvedValue({ isActive: true });

      await expect(
        service.adjust(ADJUSTMENT_DTO, USER_ID, 'ADMIN'),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        service.adjust(ADJUSTMENT_DTO, USER_ID, 'ADMIN'),
      ).rejects.toThrow(/would push the quantity below zero/);
      expect(txStockMovementCreate).not.toHaveBeenCalled();
    });

    it('rejects a missing product with 404', async () => {
      txProductUpdateMany.mockResolvedValue({ count: 0 });
      txProductFindUnique.mockResolvedValue(null);

      await expect(
        service.adjust(ADJUSTMENT_DTO, USER_ID, 'ADMIN'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(txStockMovementCreate).not.toHaveBeenCalled();
    });

    it('rejects an inactive product with 422', async () => {
      txProductUpdateMany.mockResolvedValue({ count: 0 });
      txProductFindUnique.mockResolvedValue({ isActive: false });

      await expect(
        service.adjust(ADJUSTMENT_DTO, USER_ID, 'ADMIN'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(txStockMovementCreate).not.toHaveBeenCalled();
    });

    it('retries a P2034 serialization conflict once, then succeeds', async () => {
      const conflict = new PrismaClientKnownRequestError('write conflict', {
        code: 'P2034',
        clientVersion: 'test',
      });
      $transaction
        .mockReset()
        .mockRejectedValueOnce(conflict)
        .mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));

      await expect(
        service.adjust(ADJUSTMENT_DTO, USER_ID, 'ADMIN'),
      ).resolves.toBeDefined();
      expect($transaction).toHaveBeenCalledTimes(2);
      expect(txStockMovementCreate).toHaveBeenCalledTimes(1);
    });

    it('does not retry P2034 more than once or the same error twice', async () => {
      const conflict = new PrismaClientKnownRequestError('write conflict', {
        code: 'P2034',
        clientVersion: 'test',
      });
      $transaction.mockReset().mockRejectedValue(conflict);

      await expect(
        service.adjust(ADJUSTMENT_DTO, USER_ID, 'ADMIN'),
      ).rejects.toBeInstanceOf(PrismaClientKnownRequestError);
      // Initial attempt + exactly one retry.
      expect($transaction).toHaveBeenCalledTimes(2);
      expect(txStockMovementCreate).not.toHaveBeenCalled();
    });

    it('passes unrelated errors through without retry', async () => {
      const p2002 = new PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      });
      $transaction.mockReset().mockRejectedValue(p2002);

      await expect(
        service.adjust(ADJUSTMENT_DTO, USER_ID, 'ADMIN'),
      ).rejects.toBe(p2002);
      expect($transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('applyStockChange (shared with orders/purchase orders)', () => {
    it('stamps order/purchase-order refs onto the movement row', async () => {
      await service.applyStockChange(
        tx as never,
        ADJUSTMENT_DTO.productId,
        3,
        StockMovementType.PURCHASE_RECEIPT,
        null,
        USER_ID,
        'ADMIN',
        { purchaseOrderId: '99999999-9999-4999-8999-999999999999' },
      );

      expect(txStockMovementCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: StockMovementType.PURCHASE_RECEIPT,
          purchaseOrderId: '99999999-9999-4999-8999-999999999999',
        }),
        select: expect.anything(),
      });
    });

    it('allowInactive drops the active-product requirement (cancellation restore)', async () => {
      await service.applyStockChange(
        tx as never,
        ADJUSTMENT_DTO.productId,
        2,
        StockMovementType.RETURN,
        'Cancelled order ORD-0001',
        USER_ID,
        'ADMIN',
        {
          orderId: '22222222-2222-4222-8222-222222222222',
          allowInactive: true,
        },
      );

      expect(txProductUpdateMany).toHaveBeenCalledWith({
        where: { id: ADJUSTMENT_DTO.productId },
        data: { quantity: { increment: 2 } },
      });
    });

    it('with allowInactive an inactive product is classified as insufficient (409), not 422', async () => {
      txProductUpdateMany.mockResolvedValue({ count: 0 });
      txProductFindUnique.mockResolvedValue({ isActive: false });

      await expect(
        service.applyStockChange(
          tx as never,
          ADJUSTMENT_DTO.productId,
          2,
          StockMovementType.RETURN,
          'Cancelled order',
          USER_ID,
          'ADMIN',
          {
            orderId: '22222222-2222-4222-8222-222222222222',
            allowInactive: true,
          },
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findAll (movement history)', () => {
    it('returns the contract pagination envelope with defaults', async () => {
      stockMovementCount.mockResolvedValue(1);
      stockMovementFindMany.mockResolvedValue([movementRow()]);

      const result = await service.findAll({} as ListMovementsQueryDto);

      expect(stockMovementCount).toHaveBeenCalledWith({ where: {} });
      expect(stockMovementFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          skip: 0,
          take: 20,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          select: expect.objectContaining({
            id: true,
            type: true,
            quantityAfter: true,
          }),
        }),
      );
      expect(result.data).toEqual([movementRow()]);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('applies page and limit with the skip = (page - 1) * limit rule', async () => {
      await service.findAll({ page: 3, limit: 10 } as ListMovementsQueryDto);

      expect(stockMovementFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('maps every documented filter, including the date range', async () => {
      const from = '2026-10-01T00:00:00.000Z';
      const to = '2026-10-23T23:59:59.999Z';
      await service.findAll({
        productId: ADJUSTMENT_DTO.productId,
        type: StockMovementType.ADJUSTMENT,
        orderId: '88888888-8888-4888-8888-888888888888',
        purchaseOrderId: '99999999-9999-4999-8999-999999999999',
        from,
        to,
      } as never);

      expect(stockMovementFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            productId: ADJUSTMENT_DTO.productId,
            type: StockMovementType.ADJUSTMENT,
            orderId: '88888888-8888-4888-8888-888888888888',
            purchaseOrderId: '99999999-9999-4999-8999-999999999999',
            createdAt: { gte: new Date(from), lte: new Date(to) },
          },
        }),
      );
    });

    it('applies the whitelisted sort with a deterministic tie-break', async () => {
      await service.findAll({
        sortBy: 'quantityChange',
        sortOrder: 'asc',
      } as ListMovementsQueryDto);

      expect(stockMovementFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ quantityChange: 'asc' }, { id: 'asc' }],
        }),
      );
    });

    it('returns an empty envelope when nothing matches', async () => {
      const result = await service.findAll({} as ListMovementsQueryDto);

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
    });
  });

  describe('findForProduct (GET /products/:id/movements)', () => {
    it('rejects a missing product with 404', async () => {
      productFindUnique.mockResolvedValue(null);

      await expect(
        service.findForProduct('nope', {} as ListMovementsQueryDto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(stockMovementFindMany).not.toHaveBeenCalled();
    });

    it('keeps hosting history for a soft-deleted product and forces the id filter', async () => {
      productFindUnique.mockResolvedValue({ id: ADJUSTMENT_DTO.productId });
      stockMovementFindMany.mockResolvedValue([movementRow()]);

      await service.findForProduct(ADJUSTMENT_DTO.productId, {
        page: 1,
        type: StockMovementType.SALE,
        productId: 'trojan-id-that-must-not-leak',
      } as never);

      expect(stockMovementFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            productId: ADJUSTMENT_DTO.productId,
            type: StockMovementType.SALE,
          },
        }),
      );
    });
  });

  describe('lowStock — delegates to the products service', () => {
    it('pins stockStatus=low_stock and isActive, exposes only page/limit', async () => {
      const page = {
        data: [],
        meta: { page: 2, limit: 50, total: 0, totalPages: 0 },
      };
      productsFindAll.mockResolvedValue(page);

      const result = await service.lowStock(
        { page: 2, limit: 50 } as ListMovementsQueryDto,
        'STAFF',
      );

      expect(productsFindAll).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          limit: 50,
          stockStatus: 'low_stock',
          isActive: true,
        }),
        'STAFF',
      );
      expect(result).toBe(page);
    });
  });
});
