import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

import { PrismaService } from '../prisma/prisma.service.js';
import {
  Prisma,
  OrderStatus,
  StockMovementType,
} from '../generated/prisma/client.js';
import { StockService } from '../stock/stock.service.js';
import { OrdersService } from './orders.service.js';
import type { CreateOrderDto } from './dto/create-order.dto.js';

const USER_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const PRODUCT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PRODUCT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';

const dto = (
  items: Array<{ productId: string; quantity: number }>,
  extra: Record<string, unknown> = {},
): CreateOrderDto => ({ items, ...extra }) as never;

/** Product snapshot facts read inside the transaction (§3.7 snapshots). */
const fact = (overrides: Record<string, unknown> = {}) => ({
  id: PRODUCT_A,
  name: 'Ballpoint Pen',
  sku: 'OFF-PEN-002',
  price: new Prisma.Decimal('1.99'),
  isActive: true,
  ...overrides,
});

describe('OrdersService', () => {
  let service: OrdersService;
  const $transaction = vi.fn();
  const txProductFindMany = vi.fn();
  const txOrderCount = vi.fn();
  const txOrderCreate = vi.fn();
  const txOrderFindUnique = vi.fn();
  const txOrderUpdateMany = vi.fn();
  const txOrderItemCreate = vi.fn();
  const txOrderItemFindMany = vi.fn();
  const applyStockChange = vi.fn();

  const tx = {
    product: { findMany: txProductFindMany },
    order: {
      count: txOrderCount,
      create: txOrderCreate,
      findUnique: txOrderFindUnique,
      updateMany: txOrderUpdateMany,
    },
    orderItem: { create: txOrderItemCreate, findMany: txOrderItemFindMany },
  };

  beforeEach(async () => {
    $transaction
      .mockReset()
      .mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
    txProductFindMany.mockReset().mockResolvedValue([
      fact(),
      fact({
        id: PRODUCT_B,
        name: 'Ring Notebook A5',
        sku: 'OFF-NB-001',
        price: new Prisma.Decimal('3.5'),
      }),
    ]);
    txOrderCount.mockReset().mockResolvedValue(0);
    txOrderCreate
      .mockReset()
      .mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        id: ORDER_ID,
        orderNumber: data.orderNumber,
        status: data.status,
        customerName: data.customerName ?? null,
        customerPhone: data.customerPhone ?? null,
        notes: data.notes ?? null,
        totalAmount: data.totalAmount,
        createdById: data.createdById,
        cancelledAt: null,
        createdAt: new Date('2026-10-23T12:00:00Z'),
        updatedAt: new Date('2026-10-23T12:00:00Z'),
      }));
    txOrderItemCreate
      .mockReset()
      .mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        id: '11111111-1111-4111-8111-111111111111',
        orderId: data.orderId,
        productId: data.productId,
        productName: data.productName,
        sku: data.sku,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        lineTotal: data.lineTotal,
      }));
    applyStockChange.mockReset().mockResolvedValue({
      movement: { id: 'movement-id' },
      product: { id: PRODUCT_A },
    });
    txOrderFindUnique.mockReset().mockResolvedValue({
      id: ORDER_ID,
      orderNumber: 'ORD-0001',
      status: 'PENDING',
      cancelledAt: null,
    });
    txOrderUpdateMany.mockReset().mockResolvedValue({ count: 1 });
    txOrderItemFindMany.mockReset().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: { $transaction } },
        { provide: StockService, useValue: { applyStockChange } },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  describe('create — one Serializable transaction', () => {
    it('creates the order in a Serializable transaction', async () => {
      await service.create(
        dto([{ productId: PRODUCT_A, quantity: 2 }]),
        USER_ID,
        'ADMIN',
      );

      expect($transaction).toHaveBeenCalledTimes(1);
      expect($transaction.mock.calls[0][1]).toEqual({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    });

    it('generates the next sequential orderNumber (ORD-0001 after 0 rows)', async () => {
      txOrderCount.mockResolvedValue(0);

      const result = await service.create(
        dto([{ productId: PRODUCT_A, quantity: 1 }]),
        USER_ID,
        'ADMIN',
      );

      expect(txOrderCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ orderNumber: 'ORD-0001' }),
        select: expect.objectContaining({ id: true, orderNumber: true }),
      });
      expect(result.orderNumber).toBe('ORD-0001');
    });

    it.each([
      [9, 'ORD-0010'],
      [123, 'ORD-0124'],
      [999, 'ORD-1000'],
    ])(
      'pads the orderNumber for %i existing rows -> ORD-###',
      async (count, expected) => {
        txOrderCount.mockResolvedValue(count);

        const result = await service.create(
          dto([{ productId: PRODUCT_A, quantity: 1 }]),
          USER_ID,
          'STAFF',
        );

        expect(result.orderNumber).toBe(expected);
      },
    );

    it('snapshots all product facts in one product read', async () => {
      await service.create(
        dto([
          { productId: PRODUCT_A, quantity: 2 },
          { productId: PRODUCT_B, quantity: 3 },
        ]),
        USER_ID,
        'ADMIN',
      );

      expect(txProductFindMany).toHaveBeenCalledTimes(1);
      expect(txProductFindMany).toHaveBeenCalledWith({
        where: { id: { in: [PRODUCT_A, PRODUCT_B] } },
        select: expect.objectContaining({
          id: true,
          name: true,
          sku: true,
          price: true,
          isActive: true,
        }),
      });
    });

    it('computes unitPrice, lineTotal and totalAmount server-side with decimal math', async () => {
      await service.create(
        dto([
          { productId: PRODUCT_A, quantity: 2 },
          { productId: PRODUCT_B, quantity: 3 },
        ]),
        USER_ID,
        'ADMIN',
      );

      // 2 × 1.99 = 3.98, 3 × 3.50 = 10.50, total = 14.48 (Decimal, no float drift)
      expect(txOrderCreate.mock.calls[0][0].data.totalAmount.toString()).toBe(
        '14.48',
      );

      expect(txOrderItemCreate).toHaveBeenCalledTimes(2);
      expect(txOrderItemCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: PRODUCT_A,
          quantity: 2,
          unitPrice: new Prisma.Decimal('1.99'),
          lineTotal: new Prisma.Decimal('3.98'),
        }),
        select: expect.anything(),
      });
      expect(txOrderItemCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: PRODUCT_B,
          quantity: 3,
          unitPrice: new Prisma.Decimal('3.5'),
          lineTotal: new Prisma.Decimal('10.5'),
        }),
        select: expect.anything(),
      });
    });

    it('snapshots item fields and serializes money as numbers in the 201 payload', async () => {
      const result = await service.create(
        dto([
          { productId: PRODUCT_A, quantity: 2 },
          { productId: PRODUCT_B, quantity: 3 },
        ]),
        USER_ID,
        'ADMIN',
      );

      expect(result.totalAmount).toBe(14.48);
      expect(result.status).toBe(OrderStatus.PENDING);
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({
        id: '11111111-1111-4111-8111-111111111111',
        orderId: ORDER_ID,
        productId: PRODUCT_A,
        productName: 'Ballpoint Pen',
        sku: 'OFF-PEN-002',
        quantity: 2,
        unitPrice: 1.99,
        lineTotal: 3.98,
      });
    });

    it('stamps PENDING status and createdById from the current user', async () => {
      await service.create(
        dto([{ productId: PRODUCT_A, quantity: 1 }], {
          customerName: 'Walk-in customer',
        }),
        USER_ID,
        'ADMIN',
      );

      expect(txOrderCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: OrderStatus.PENDING,
          createdById: USER_ID,
          customerName: 'Walk-in customer',
        }),
        select: expect.anything(),
      });
    });
  });

  describe('validation and rollback', () => {
    it('rejects duplicate product lines with 400 before any transaction opens', async () => {
      await expect(
        service.create(
          dto([
            { productId: PRODUCT_A, quantity: 2 },
            { productId: PRODUCT_A, quantity: 1 },
          ]),
          USER_ID,
          'ADMIN',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect($transaction).not.toHaveBeenCalled();
      expect(txProductFindMany).not.toHaveBeenCalled();
    });

    it('rejects a missing product with 404 — nothing is written', async () => {
      txProductFindMany.mockResolvedValue([
        fact({
          id: PRODUCT_B,
          name: 'Ring Notebook A5',
          sku: 'OFF-NB-001',
          price: new Prisma.Decimal('3.5'),
        }),
      ]);

      await expect(
        service.create(
          dto([
            { productId: PRODUCT_A, quantity: 1 }, // not returned by findMany
            { productId: PRODUCT_B, quantity: 1 },
          ]),
          USER_ID,
          'ADMIN',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(txOrderCreate).not.toHaveBeenCalled();
      expect(txOrderItemCreate).not.toHaveBeenCalled();
      expect(applyStockChange).not.toHaveBeenCalled();
    });

    it('rejects an inactive product with 422 before creating anything', async () => {
      txProductFindMany.mockResolvedValue([fact({ isActive: false })]);

      await expect(
        service.create(
          dto([{ productId: PRODUCT_A, quantity: 1 }]),
          USER_ID,
          'ADMIN',
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(txOrderCreate).not.toHaveBeenCalled();
      expect(applyStockChange).not.toHaveBeenCalled();
    });

    it('propagates a stock failure as 409 and stops — nothing partially succeeds', async () => {
      const conflict = new ConflictException(
        `Insufficient stock: product ${PRODUCT_B} change -2 would push the quantity below zero`,
      );
      applyStockChange
        .mockResolvedValueOnce({ movement: {}, product: {} })
        .mockRejectedValueOnce(conflict);

      await expect(
        service.create(
          dto([
            { productId: PRODUCT_A, quantity: 1 },
            { productId: PRODUCT_B, quantity: 2 },
          ]),
          USER_ID,
          'ADMIN',
        ),
      ).rejects.toThrow(/Insufficient stock/);

      // First line deducted, second line failed — the exception thrown inside
      // $transaction makes Postgres roll the whole order write back.
      expect(applyStockChange).toHaveBeenCalledTimes(2);
      expect((applyStockChange.mock.calls[1] as unknown[])[2]).toBe(-2);
    });
  });

  describe('stock integration through the shared service', () => {
    it('sends one SALE decrement per line stamped with the new order id', async () => {
      await service.create(
        dto([
          { productId: PRODUCT_A, quantity: 2 },
          { productId: PRODUCT_B, quantity: 3 },
        ]),
        USER_ID,
        'ADMIN',
      );

      expect(applyStockChange.mock.calls[0][0]).toBe(tx); // the SAME transaction client
      expect(applyStockChange).toHaveBeenCalledWith(
        tx,
        PRODUCT_A,
        -2,
        StockMovementType.SALE,
        null,
        USER_ID,
        'ADMIN',
        {
          orderId: ORDER_ID,
        },
      );
      expect(applyStockChange).toHaveBeenCalledWith(
        tx,
        PRODUCT_B,
        -3,
        StockMovementType.SALE,
        null,
        USER_ID,
        'ADMIN',
        {
          orderId: ORDER_ID,
        },
      );
    });

    it('passes the requester role through to the shared stock write (STAFF)', async () => {
      await service.create(
        dto([{ productId: PRODUCT_A, quantity: 1 }]),
        USER_ID,
        'STAFF',
      );

      expect(applyStockChange).toHaveBeenCalledWith(
        tx,
        PRODUCT_A,
        -1,
        StockMovementType.SALE,
        null,
        USER_ID,
        'STAFF',
        { orderId: ORDER_ID },
      );
    });
  });

  describe('retry on write conflicts', () => {
    it('retries a P2034 Serializable conflict once, then succeeds', async () => {
      const conflict = new PrismaClientKnownRequestError('write conflict', {
        code: 'P2034',
        clientVersion: 'test',
      });
      $transaction
        .mockReset()
        .mockRejectedValueOnce(conflict)
        .mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));

      await expect(
        service.create(
          dto([{ productId: PRODUCT_A, quantity: 1 }]),
          USER_ID,
          'ADMIN',
        ),
      ).resolves.toBeDefined();

      expect($transaction).toHaveBeenCalledTimes(2);
      expect(applyStockChange).toHaveBeenCalledTimes(1); // fresh transaction started cleanly
    });

    it('gives up after one P2034 retry (two attempts total)', async () => {
      const conflict = new PrismaClientKnownRequestError('write conflict', {
        code: 'P2034',
        clientVersion: 'test',
      });
      $transaction.mockReset().mockRejectedValue(conflict);

      await expect(
        service.create(
          dto([{ productId: PRODUCT_A, quantity: 1 }]),
          USER_ID,
          'ADMIN',
        ),
      ).rejects.toBeInstanceOf(PrismaClientKnownRequestError);
      expect($transaction).toHaveBeenCalledTimes(2);
      expect(applyStockChange).not.toHaveBeenCalled();
    });

    it('retries an orderNumber P2002 race once, then succeeds', async () => {
      const race = new PrismaClientKnownRequestError('dup orderNumber', {
        code: 'P2002',
        clientVersion: 'test',
      });
      $transaction
        .mockReset()
        .mockRejectedValueOnce(race)
        .mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));

      await expect(
        service.create(
          dto([{ productId: PRODUCT_A, quantity: 1 }]),
          USER_ID,
          'ADMIN',
        ),
      ).resolves.toBeDefined();
      expect($transaction).toHaveBeenCalledTimes(2);
    });

    it('does not retry unrelated failures', async () => {
      const boom = new Error('boom');
      $transaction.mockReset().mockRejectedValue(boom);

      await expect(
        service.create(
          dto([{ productId: PRODUCT_A, quantity: 1 }]),
          USER_ID,
          'ADMIN',
        ),
      ).rejects.toBe(boom);
      expect($transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateStatus — transitions and cancellation (#29)', () => {
    const statusDto = (newStatus: OrderStatus) => ({ newStatus }) as never;
    const instrumentItem = (productId: string, quantity: number) => ({
      id: '11111111-1111-4111-8111-111111111111',
      orderId: ORDER_ID,
      productId,
      productName:
        productId === PRODUCT_A ? 'Ballpoint Pen' : 'Ring Notebook A5',
      sku: productId === PRODUCT_A ? 'OFF-PEN-002' : 'OFF-NB-001',
      quantity,
      unitPrice:
        productId === PRODUCT_A
          ? new Prisma.Decimal('1.99')
          : new Prisma.Decimal('3.5'),
      lineTotal:
        productId === PRODUCT_A
          ? new Prisma.Decimal('3.98')
          : new Prisma.Decimal('10.5'),
    });
    /** A post-update order row for the response re-read. */
    const updatedOrderRow = (
      status: OrderStatus,
      cancelledAt: Date | null,
    ) => ({
      id: ORDER_ID,
      orderNumber: 'ORD-0001',
      status,
      customerName: null,
      customerPhone: null,
      notes: null,
      totalAmount: new Prisma.Decimal('14.48'),
      createdById: USER_ID,
      cancelledAt,
      createdAt: new Date('2026-10-23T12:00:00Z'),
      updatedAt: new Date('2026-10-23T13:00:00Z'),
    });

    it('runs the status write in ONE Serializable transaction', async () => {
      txOrderFindUnique
        .mockResolvedValueOnce({
          id: ORDER_ID,
          orderNumber: 'ORD-0001',
          status: 'PENDING',
          cancelledAt: null,
        })
        .mockResolvedValueOnce(updatedOrderRow(OrderStatus.CONFIRMED, null));

      await service.updateStatus(
        ORDER_ID,
        statusDto(OrderStatus.CONFIRMED),
        USER_ID,
        'ADMIN',
      );

      expect($transaction).toHaveBeenCalledTimes(1);
      expect($transaction.mock.calls[0][1]).toEqual({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    });

    it('PENDING → CONFIRMED — plain status write, nothing restored', async () => {
      txOrderFindUnique
        .mockResolvedValueOnce({
          id: ORDER_ID,
          orderNumber: 'ORD-0001',
          status: 'PENDING',
          cancelledAt: null,
        })
        .mockResolvedValueOnce(updatedOrderRow(OrderStatus.CONFIRMED, null));

      await service.updateStatus(
        ORDER_ID,
        statusDto(OrderStatus.CONFIRMED),
        USER_ID,
        'ADMIN',
      );

      expect(txOrderUpdateMany).toHaveBeenCalledWith({
        where: { id: ORDER_ID, status: OrderStatus.PENDING },
        data: { status: OrderStatus.CONFIRMED },
      });
      expect(applyStockChange).not.toHaveBeenCalled();
    });

    it('PENDING → CANCELLED restores every line with RETURN movements in the same tx', async () => {
      txOrderFindUnique
        .mockResolvedValueOnce({
          id: ORDER_ID,
          orderNumber: 'ORD-0001',
          status: 'PENDING',
          cancelledAt: null,
        })
        .mockResolvedValueOnce(
          updatedOrderRow(
            OrderStatus.CANCELLED,
            new Date('2026-10-23T13:00:00Z'),
          ),
        );
      txOrderItemFindMany
        .mockResolvedValueOnce([
          instrumentItem(PRODUCT_A, 2),
          instrumentItem(PRODUCT_B, 3),
        ])
        .mockResolvedValueOnce([
          instrumentItem(PRODUCT_A, 2),
          instrumentItem(PRODUCT_B, 3),
        ]);

      const result = await service.updateStatus(
        ORDER_ID,
        statusDto(OrderStatus.CANCELLED),
        USER_ID,
        'ADMIN',
      );

      expect(txOrderUpdateMany).toHaveBeenCalledWith({
        where: { id: ORDER_ID, status: OrderStatus.PENDING },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: expect.any(Date),
        },
      });
      expect(applyStockChange).toHaveBeenCalledTimes(2);
      expect(applyStockChange).toHaveBeenCalledWith(
        tx,
        PRODUCT_A,
        2,
        StockMovementType.RETURN,
        'Cancelled order ORD-0001',
        USER_ID,
        'ADMIN',
        {
          orderId: ORDER_ID,
          allowInactive: true,
        },
      );
      expect(applyStockChange).toHaveBeenCalledWith(
        tx,
        PRODUCT_B,
        3,
        StockMovementType.RETURN,
        'Cancelled order ORD-0001',
        USER_ID,
        'ADMIN',
        {
          orderId: ORDER_ID,
          allowInactive: true,
        },
      );
      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(result.cancelledAt).toEqual(new Date('2026-10-23T13:00:00Z'));
      // money serialized as numbers
      expect(result.totalAmount).toBe(14.48);
      expect(result.items[0]).toMatchObject({
        productId: PRODUCT_A,
        quantity: 2,
        unitPrice: 1.99,
        lineTotal: 3.98,
      });
    });

    it('CONFIRMED → CANCELLED is allowed and records the caller identity (STAFF)', async () => {
      txOrderFindUnique
        .mockResolvedValueOnce({
          id: ORDER_ID,
          orderNumber: 'ORD-0001',
          status: 'CONFIRMED',
          cancelledAt: null,
        })
        .mockResolvedValueOnce(
          updatedOrderRow(
            OrderStatus.CANCELLED,
            new Date('2026-10-23T13:00:00Z'),
          ),
        );
      txOrderItemFindMany.mockResolvedValue([instrumentItem(PRODUCT_A, 2)]);

      await service.updateStatus(
        ORDER_ID,
        statusDto(OrderStatus.CANCELLED),
        USER_ID,
        'STAFF',
      );

      expect(txOrderUpdateMany).toHaveBeenCalledWith({
        where: { id: ORDER_ID, status: OrderStatus.CONFIRMED },
        data: { status: OrderStatus.CANCELLED, cancelledAt: expect.any(Date) },
      });
      expect(applyStockChange).toHaveBeenCalledWith(
        tx,
        PRODUCT_A,
        2,
        StockMovementType.RETURN,
        'Cancelled order ORD-0001',
        USER_ID,
        'STAFF',
        {
          orderId: ORDER_ID,
          allowInactive: true,
        },
      );
    });

    it.each([
      [
        'PENDING → PENDING (same-status no-op)',
        OrderStatus.PENDING,
        OrderStatus.PENDING,
      ],
      [
        'CONFIRMED → PENDING (backwards)',
        OrderStatus.CONFIRMED,
        OrderStatus.PENDING,
      ],
      [
        'CONFIRMED → CONFIRMED (same-status no-op)',
        OrderStatus.CONFIRMED,
        OrderStatus.CONFIRMED,
      ],
      [
        'CANCELLED → PENDING (un-cancel)',
        OrderStatus.CANCELLED,
        OrderStatus.PENDING,
      ],
      ['CANCELLED → CONFIRMED', OrderStatus.CANCELLED, OrderStatus.CONFIRMED],
      [
        'CANCELLED → CANCELLED (double cancel)',
        OrderStatus.CANCELLED,
        OrderStatus.CANCELLED,
      ],
    ] as const)('rejects %s with 409', async (_name, from, to) => {
      txOrderFindUnique
        .mockResolvedValue({
          id: ORDER_ID,
          orderNumber: 'ORD-0001',
          status: from,
          cancelledAt: from === OrderStatus.CANCELLED ? new Date() : null,
        })
        .mockResolvedValue({
          id: ORDER_ID,
          orderNumber: 'ORD-0001',
          status: from,
          cancelledAt: from === OrderStatus.CANCELLED ? new Date() : null,
        });

      await expect(
        service.updateStatus(ORDER_ID, statusDto(to), USER_ID, 'ADMIN'),
      ).rejects.toBeInstanceOf(ConflictException);

      // Terminal or invalid transitions never touch the DB or the stock.
      expect(txOrderUpdateMany).not.toHaveBeenCalled();
      expect(applyStockChange).not.toHaveBeenCalled();
    });

    it('cancelling twice never restores stock twice', async () => {
      txOrderFindUnique.mockResolvedValue({
        id: ORDER_ID,
        orderNumber: 'ORD-0001',
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date('2026-10-23T13:00:00Z'),
      });

      await expect(
        service.updateStatus(
          ORDER_ID,
          statusDto(OrderStatus.CANCELLED),
          USER_ID,
          'ADMIN',
        ),
      ).rejects.toThrow(/CANCELLED/);

      expect(applyStockChange).not.toHaveBeenCalled();
      expect(txOrderItemFindMany).not.toHaveBeenCalled();
    });

    it('rejects a missing order with 404 before any write', async () => {
      txOrderFindUnique.mockReset().mockResolvedValue(null);

      await expect(
        service.updateStatus(
          'no-such-order',
          statusDto(OrderStatus.CONFIRMED),
          USER_ID,
          'ADMIN',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(txOrderUpdateMany).not.toHaveBeenCalled();
      expect(applyStockChange).not.toHaveBeenCalled();
    });

    it('409s from the status-conditional backstop when the state changed concurrently (no restore)', async () => {
      txOrderUpdateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateStatus(
          ORDER_ID,
          statusDto(OrderStatus.CANCELLED),
          USER_ID,
          'ADMIN',
        ),
      ).rejects.toThrow(/changed status concurrently/);

      expect(applyStockChange).not.toHaveBeenCalled();
    });

    it('retries a P2034 conflict once for status writes', async () => {
      const conflict = new PrismaClientKnownRequestError('write conflict', {
        code: 'P2034',
        clientVersion: 'test',
      });
      $transaction
        .mockReset()
        .mockRejectedValueOnce(conflict)
        .mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
      txOrderFindUnique
        .mockResolvedValueOnce({
          id: ORDER_ID,
          orderNumber: 'ORD-0001',
          status: 'PENDING',
          cancelledAt: null,
        })
        .mockResolvedValueOnce(updatedOrderRow(OrderStatus.CONFIRMED, null));

      await expect(
        service.updateStatus(
          ORDER_ID,
          statusDto(OrderStatus.CONFIRMED),
          USER_ID,
          'ADMIN',
        ),
      ).resolves.toBeDefined();
      expect($transaction).toHaveBeenCalledTimes(2);
      // Fresh transaction started cleanly — only one write happened.
      expect(txOrderUpdateMany).toHaveBeenCalledTimes(1);
    });
  });
});
