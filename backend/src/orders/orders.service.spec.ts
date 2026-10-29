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
  UserRole,
} from '../generated/prisma/client.js';
import { StockService } from '../stock/stock.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AuditService } from '../audit/audit.service.js';
import { OrdersService } from './orders.service.js';
import type { CreateOrderDto } from './dto/create-order.dto.js';

const USER_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const PRODUCT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PRODUCT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';
const CUSTOMER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

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
  const txOrderFindFirst = vi.fn();
  const txOrderUpdateMany = vi.fn();
  const txOrderItemCreate = vi.fn();
  const txOrderItemFindMany = vi.fn();
  const applyStockChange = vi.fn();
  const notifyOrderCreated = vi.fn();
  const notifyOrderConfirmed = vi.fn();
  const notifyOrderCancelled = vi.fn();
  const notifyLowStockIfDepleted = vi.fn();
  const auditLog = vi.fn();
  const orderNoteCreate = vi.fn();
  const orderNoteFindMany = vi.fn();

  const tx = {
    product: { findMany: txProductFindMany },
    order: {
      count: txOrderCount,
      create: txOrderCreate,
      findUnique: txOrderFindUnique,
      findFirst: txOrderFindFirst,
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
        customerId: data.customerId ?? null,
        recipientName: data.recipientName ?? null,
        recipientPhone: data.recipientPhone ?? null,
        shippingAddress: data.shippingAddress ?? null,
        shippingCity: data.shippingCity ?? null,
        paymentMethod: data.paymentMethod ?? 'COD',
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
      product: {
        id: PRODUCT_A,
        name: 'Ballpoint Pen',
        quantity: 3, // depleted by default so LOW_STOCK triggers fire
        minStock: 50,
      },
    });
    txOrderFindUnique.mockReset().mockResolvedValue({
      id: ORDER_ID,
      orderNumber: 'ORD-0001',
      status: 'PENDING',
      cancelledAt: null,
    });
    txOrderFindFirst.mockReset().mockResolvedValue({
      id: ORDER_ID,
      orderNumber: 'ORD-0001',
      status: 'PENDING',
      cancelledAt: null,
    });
    txOrderUpdateMany.mockReset().mockResolvedValue({ count: 1 });
    txOrderItemFindMany.mockReset().mockResolvedValue([]);
    notifyOrderCreated.mockReset().mockResolvedValue(undefined);
    notifyOrderConfirmed.mockReset().mockResolvedValue(undefined);
    notifyOrderCancelled.mockReset().mockResolvedValue(undefined);
    notifyLowStockIfDepleted.mockReset().mockResolvedValue(undefined);
    auditLog.mockReset().mockResolvedValue(undefined);
    orderNoteCreate.mockReset();
    orderNoteFindMany.mockReset().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: {
            $transaction,
            order: {
              count: vi.fn(),
              findMany: vi.fn(),
              findUnique: vi.fn(),
              findFirst: vi.fn(),
              update: vi.fn(),
            },
            orderNote: {
              create: orderNoteCreate,
              findMany: orderNoteFindMany,
            },
          },
        },
        { provide: StockService, useValue: { applyStockChange } },
        { provide: AuditService, useValue: { log: auditLog } },
        {
          provide: NotificationsService,
          useValue: {
            notifyOrderCreated,
            notifyOrderConfirmed,
            notifyOrderCancelled,
            notifyLowStockIfDepleted,
          },
        },
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

  describe('post-commit notification events (#31, best-effort)', () => {
    const statusDto = (newStatus: OrderStatus) => ({ newStatus }) as never;
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
      customerId: null,
      createdById: USER_ID,
      cancelledAt,
      createdAt: new Date('2026-10-23T12:00:00Z'),
      updatedAt: new Date('2026-10-24T13:00:00Z'),
    });

    it('fires ORDER_CREATED with the created order after a successful create', async () => {
      await service.create(
        dto([
          { productId: PRODUCT_A, quantity: 2 },
          { productId: PRODUCT_B, quantity: 3 },
        ]),
        USER_ID,
        'ADMIN',
      );

      expect(notifyOrderCreated).toHaveBeenCalledTimes(1);
      expect(notifyOrderCreated).toHaveBeenCalledWith({
        id: ORDER_ID,
        orderNumber: 'ORD-0001',
        totalAmount: 14.48,
      });
    });

    it('fires LOW_STOCK for sold lines that fell to/below minStock', async () => {
      await service.create(
        dto([
          { productId: PRODUCT_A, quantity: 2 },
          { productId: PRODUCT_B, quantity: 3 },
        ]),
        USER_ID,
        'ADMIN',
      );

      // every applyStockChange result product is depleted by the default mock
      expect(notifyLowStockIfDepleted).toHaveBeenCalledTimes(2);
      expect(notifyLowStockIfDepleted).toHaveBeenCalledWith(
        expect.objectContaining({ id: PRODUCT_A, minStock: 50 }),
      );
    });

    it('passes sold-line products to the fan-out — the depletion gate lives in the notifications service', async () => {
      applyStockChange.mockReset().mockResolvedValue({
        movement: { id: 'movement-id' },
        product: {
          id: PRODUCT_A,
          name: 'Ballpoint Pen',
          quantity: 60,
          minStock: 50,
        },
      });

      await service.create(
        dto([{ productId: PRODUCT_A, quantity: 1 }]),
        USER_ID,
        'ADMIN',
      );

      // The healthy product is still passed; NotificationsService itself
      // no-ops when quantity > minStock (covered in its own spec).
      expect(notifyLowStockIfDepleted).toHaveBeenCalledTimes(1);
      expect(notifyLowStockIfDepleted).toHaveBeenCalledWith(
        expect.objectContaining({ id: PRODUCT_A, quantity: 60 }),
      );
    });

    it('does not fire ORDER_CREATED when the order fails (e.g. duplicate lines)', async () => {
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

      expect(notifyOrderCreated).not.toHaveBeenCalled();
      expect(notifyLowStockIfDepleted).not.toHaveBeenCalled();
    });

    it('fires ORDER_CANCELLED only for cancels — not for confirmations', async () => {
      txOrderFindUnique
        .mockReset()
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
      expect(notifyOrderCancelled).not.toHaveBeenCalled();

      txOrderFindUnique
        .mockReset()
        .mockResolvedValueOnce({
          id: ORDER_ID,
          orderNumber: 'ORD-0001',
          status: 'PENDING',
          cancelledAt: null,
        })
        .mockResolvedValueOnce(
          updatedOrderRow(
            OrderStatus.CANCELLED,
            new Date('2026-10-24T13:00:00Z'),
          ),
        );

      await service.updateStatus(
        ORDER_ID,
        statusDto(OrderStatus.CANCELLED),
        USER_ID,
        'ADMIN',
      );
      expect(notifyOrderCancelled).toHaveBeenCalledTimes(1);
      expect(notifyOrderCancelled).toHaveBeenCalledWith({
        id: ORDER_ID,
        orderNumber: 'ORD-0001',
        totalAmount: 14.48,
      });
    });

    it('fires ORDER_CONFIRMED with the owning customer after a confirmation', async () => {
      txOrderFindUnique
        .mockReset()
        .mockResolvedValueOnce({
          id: ORDER_ID,
          orderNumber: 'ORD-0001',
          status: 'PENDING',
          cancelledAt: null,
        })
        .mockResolvedValueOnce({
          ...updatedOrderRow(OrderStatus.CONFIRMED, null),
          customerId: CUSTOMER_ID,
        });

      await service.updateStatus(
        ORDER_ID,
        statusDto(OrderStatus.CONFIRMED),
        USER_ID,
        'ADMIN',
      );

      expect(notifyOrderCancelled).not.toHaveBeenCalled();
      expect(notifyOrderConfirmed).toHaveBeenCalledTimes(1);
      expect(notifyOrderConfirmed).toHaveBeenCalledWith({
        id: ORDER_ID,
        orderNumber: 'ORD-0001',
        customerId: CUSTOMER_ID,
      });
    });
  });

  describe('findAll', () => {
    it('returns paginated orders and applies defaults', async () => {
      const prisma = (
        service as unknown as {
          prisma: {
            order: {
              count: ReturnType<typeof vi.fn>;
              findMany: ReturnType<typeof vi.fn>;
            };
          };
        }
      ).prisma;
      prisma.order.count.mockResolvedValue(1);
      prisma.order.findMany.mockResolvedValue([
        {
          id: ORDER_ID,
          orderNumber: 'ORD-0001',
          status: 'PENDING',
          customerName: 'Walk-in',
          customerPhone: null,
          notes: null,
          totalAmount: new Prisma.Decimal('14.48'),
          createdById: USER_ID,
          cancelledAt: null,
          createdAt: new Date('2026-10-23T12:00:00Z'),
          updatedAt: new Date('2026-10-23T12:00:00Z'),
        },
      ]);

      const res = await service.findAll({});
      expect(res.data).toHaveLength(1);
      expect(res.data[0].totalAmount).toBe(14.48);
      expect(res.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    it('rejects invalid date ranges with BadRequestException (400)', async () => {
      await expect(
        service.findAll({
          from: '2026-10-25T00:00:00Z',
          to: '2026-10-20T00:00:00Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('omits phone and shipping address for SUPPORT list rows only', async () => {
      const prisma = (
        service as unknown as {
          prisma: {
            order: {
              count: ReturnType<typeof vi.fn>;
              findMany: ReturnType<typeof vi.fn>;
            };
          };
        }
      ).prisma;
      prisma.order.count.mockResolvedValue(1);
      prisma.order.findMany.mockResolvedValue([
        {
          id: ORDER_ID,
          orderNumber: 'ORD-0001',
          status: 'PENDING',
          customerName: 'Jane Doe',
          customerPhone: '+201005551234',
          notes: null,
          totalAmount: new Prisma.Decimal('14.48'),
          customerId: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
          recipientName: 'Jane Doe',
          recipientPhone: '+201005551234',
          shippingAddress: '12 Nile Street',
          shippingCity: 'Cairo',
          paymentMethod: 'COD',
          createdById: USER_ID,
          cancelledAt: null,
          createdAt: new Date('2026-10-23T12:00:00Z'),
          updatedAt: new Date('2026-10-23T12:00:00Z'),
        },
      ]);

      const support = await service.findAll({}, 'SUPPORT');
      expect(support.data[0]).not.toHaveProperty('customerPhone');
      expect(support.data[0]).not.toHaveProperty('recipientPhone');
      expect(support.data[0]).not.toHaveProperty('shippingAddress');
      // Non-PII fields stay available for support triage.
      expect(support.data[0].customerName).toBe('Jane Doe');
      expect(support.data[0].shippingCity).toBe('Cairo');

      const admin = await service.findAll({}, 'ADMIN');
      expect(admin.data[0].customerPhone).toBe('+201005551234');
      expect(admin.data[0].recipientPhone).toBe('+201005551234');
      expect(admin.data[0].shippingAddress).toBe('12 Nile Street');
    });
  });

  describe('findOne', () => {
    it('returns order details with items, createdBy, and stock movements', async () => {
      const prisma = (
        service as unknown as {
          prisma: { order: { findUnique: ReturnType<typeof vi.fn> } };
        }
      ).prisma;
      prisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        orderNumber: 'ORD-0001',
        status: 'PENDING',
        customerName: 'Walk-in',
        customerPhone: null,
        notes: null,
        totalAmount: new Prisma.Decimal('14.48'),
        createdById: USER_ID,
        cancelledAt: null,
        createdAt: new Date('2026-10-23T12:00:00Z'),
        updatedAt: new Date('2026-10-23T12:00:00Z'),
        orderItems: [
          {
            id: 'item-1',
            orderId: ORDER_ID,
            productId: PRODUCT_A,
            productName: 'Ballpoint Pen',
            sku: 'OFF-PEN-002',
            quantity: 2,
            unitPrice: new Prisma.Decimal('1.99'),
            lineTotal: new Prisma.Decimal('3.98'),
          },
        ],
        createdBy: { id: USER_ID, name: 'Admin', email: 'admin@example.com' },
        stockMovements: [],
      });

      const res = await service.findOne(ORDER_ID);
      expect(res.id).toBe(ORDER_ID);
      expect(res.items[0].unitPrice).toBe(1.99);
      expect(res.createdBy.email).toBe('admin@example.com');
      expect(res.stockMovements).toEqual([]);
    });

    it('throws NotFoundException (404) if order does not exist', async () => {
      const prisma = (
        service as unknown as {
          prisma: { order: { findUnique: ReturnType<typeof vi.fn> } };
        }
      ).prisma;
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('00000000-0000-4000-8000-000000000000'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it.each(['SUPPORT', 'STAFF'] as const)(
      'audits a %s detail view with viewer/order identity only',
      async (role) => {
        const prisma = (
          service as unknown as {
            prisma: { order: { findUnique: ReturnType<typeof vi.fn> } };
          }
        ).prisma;
        prisma.order.findUnique.mockResolvedValue({
          id: ORDER_ID,
          orderNumber: 'ORD-0001',
          status: 'PENDING',
          customerName: 'Jane Doe',
          customerPhone: '+201005551234',
          notes: null,
          totalAmount: new Prisma.Decimal('14.48'),
          customerId: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
          recipientName: 'Jane Doe',
          recipientPhone: '+201005551234',
          shippingAddress: '12 Nile Street',
          shippingCity: 'Cairo',
          paymentMethod: 'COD',
          createdById: USER_ID,
          cancelledAt: null,
          createdAt: new Date('2026-10-23T12:00:00Z'),
          updatedAt: new Date('2026-10-23T12:00:00Z'),
          orderItems: [],
          createdBy: {
            id: USER_ID,
            name: 'Admin',
            email: 'admin@example.com',
          },
          stockMovements: [],
        });

        await service.findOne(ORDER_ID, 'viewer-id', role);

        expect(auditLog).toHaveBeenCalledTimes(1);
        expect(auditLog).toHaveBeenCalledWith({
          userId: 'viewer-id',
          action: 'order.viewed',
          entityType: 'order',
          entityId: ORDER_ID,
          newValues: { viewerId: 'viewer-id', viewerRole: role },
        });
        // PII never enters the audit payload.
        const payload = JSON.stringify(auditLog.mock.calls[0][0]);
        expect(payload).not.toContain('+201005551234');
        expect(payload).not.toContain('12 Nile Street');
      },
    );

    it.each(['ADMIN', undefined] as const)(
      'does not audit a detail view by %s',
      async (role) => {
        const prisma = (
          service as unknown as {
            prisma: { order: { findUnique: ReturnType<typeof vi.fn> } };
          }
        ).prisma;
        prisma.order.findUnique.mockResolvedValue({
          id: ORDER_ID,
          orderNumber: 'ORD-0001',
          status: 'PENDING',
          customerName: 'Walk-in',
          customerPhone: null,
          notes: null,
          totalAmount: new Prisma.Decimal('14.48'),
          createdById: USER_ID,
          cancelledAt: null,
          createdAt: new Date('2026-10-23T12:00:00Z'),
          updatedAt: new Date('2026-10-23T12:00:00Z'),
          orderItems: [],
          createdBy: { id: USER_ID, name: 'Admin', email: 'admin@example.com' },
          stockMovements: [],
        });

        await service.findOne(ORDER_ID, 'viewer-id', role);

        expect(auditLog).not.toHaveBeenCalled();
      },
    );
  });

  describe('internal order notes', () => {
    const note = {
      id: '33333333-3333-4333-8333-333333333333',
      orderId: ORDER_ID,
      authorId: USER_ID,
      note: 'Customer called about delivery',
      author: { id: USER_ID, name: 'Support Agent' },
      createdAt: new Date('2026-10-30T12:00:00Z'),
    };

    it('creates a note for an existing order with the caller as author', async () => {
      const prisma = (
        service as unknown as {
          prisma: {
            order: { findUnique: ReturnType<typeof vi.fn> };
          };
        }
      ).prisma;
      prisma.order.findUnique.mockResolvedValue({ id: ORDER_ID });
      orderNoteCreate.mockResolvedValue(note);

      const res = await service.createNote(
        ORDER_ID,
        { note: 'Customer called about delivery' },
        USER_ID,
      );

      expect(orderNoteCreate).toHaveBeenCalledWith({
        data: {
          orderId: ORDER_ID,
          authorId: USER_ID,
          note: 'Customer called about delivery',
        },
        select: expect.anything(),
      });
      expect(res).toEqual(note);
    });

    it('answers 404 when the order does not exist (nothing written)', async () => {
      const prisma = (
        service as unknown as {
          prisma: {
            order: { findUnique: ReturnType<typeof vi.fn> };
          };
        }
      ).prisma;
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.createNote(ORDER_ID, { note: 'internal' }, USER_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(orderNoteCreate).not.toHaveBeenCalled();
    });

    it('lists notes oldest first', async () => {
      const prisma = (
        service as unknown as {
          prisma: {
            order: { findUnique: ReturnType<typeof vi.fn> };
          };
        }
      ).prisma;
      prisma.order.findUnique.mockResolvedValue({ id: ORDER_ID });
      orderNoteFindMany.mockResolvedValue([note]);

      const res = await service.findNotes(ORDER_ID);

      expect(orderNoteFindMany).toHaveBeenCalledWith({
        where: { orderId: ORDER_ID },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: expect.anything(),
      });
      expect(res).toEqual([note]);
    });

    it('answers 404 listing notes for a missing order', async () => {
      const prisma = (
        service as unknown as {
          prisma: {
            order: { findUnique: ReturnType<typeof vi.fn> };
          };
        }
      ).prisma;
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.findNotes(ORDER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(orderNoteFindMany).not.toHaveBeenCalled();
    });
  });

  describe('cancelPending - SUPPORT may only cancel PENDING orders', () => {
    const updatedRow = (status: OrderStatus, cancelledAt: Date | null) => ({
      id: ORDER_ID,
      orderNumber: 'ORD-0001',
      status,
      customerName: 'Jane Doe',
      customerPhone: '+201005551234',
      notes: null,
      totalAmount: new Prisma.Decimal('14.48'),
      customerId: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
      recipientName: 'Jane Doe',
      recipientPhone: '+201005551234',
      shippingAddress: '12 Nile Street',
      shippingCity: 'Cairo',
      paymentMethod: 'COD',
      createdById: USER_ID,
      cancelledAt,
      createdAt: new Date('2026-10-23T12:00:00Z'),
      updatedAt: new Date('2026-10-23T13:00:00Z'),
    });
    const line = {
      id: '11111111-1111-4111-8111-111111111111',
      orderId: ORDER_ID,
      productId: PRODUCT_A,
      productName: 'Ballpoint Pen',
      sku: 'OFF-PEN-002',
      quantity: 2,
      unitPrice: new Prisma.Decimal('1.99'),
      lineTotal: new Prisma.Decimal('3.98'),
    };

    it('cancels a PENDING order once, restoring stock with a RETURN movement', async () => {
      const cancelledAt = new Date('2026-10-23T13:00:00Z');
      txOrderFindUnique
        .mockResolvedValueOnce({
          id: ORDER_ID,
          orderNumber: 'ORD-0001',
          status: OrderStatus.PENDING,
          cancelledAt: null,
        })
        .mockResolvedValueOnce(updatedRow(OrderStatus.CANCELLED, cancelledAt));
      txOrderItemFindMany
        .mockResolvedValueOnce([{ productId: PRODUCT_A, quantity: 2 }])
        .mockResolvedValueOnce([line]);

      const res = await service.cancelPending(ORDER_ID, USER_ID, 'SUPPORT');

      expect(txOrderUpdateMany).toHaveBeenCalledWith({
        where: { id: ORDER_ID, status: OrderStatus.PENDING },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: expect.any(Date),
        },
      });
      expect(applyStockChange).toHaveBeenCalledTimes(1);
      expect(applyStockChange).toHaveBeenCalledWith(
        tx,
        PRODUCT_A,
        2,
        StockMovementType.RETURN,
        'Cancelled order ORD-0001',
        USER_ID,
        'SUPPORT',
        { orderId: ORDER_ID, allowInactive: true },
      );
      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          action: 'order.cancelled',
          entityType: 'order',
          entityId: ORDER_ID,
        }),
        tx,
      );
      expect(res.status).toBe(OrderStatus.CANCELLED);
      expect(notifyOrderCancelled).toHaveBeenCalledTimes(1);
      expect(notifyOrderCancelled).toHaveBeenCalledWith({
        id: ORDER_ID,
        orderNumber: 'ORD-0001',
        totalAmount: 14.48,
        customerId: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
      });
    });

    it.each([OrderStatus.CONFIRMED, OrderStatus.CANCELLED])(
      'rejects a %s order with 409 before any write (double cancel safe)',
      async (status) => {
        txOrderFindUnique.mockResolvedValueOnce({
          id: ORDER_ID,
          orderNumber: 'ORD-0001',
          status,
          cancelledAt: null,
        });

        await expect(
          service.cancelPending(ORDER_ID, USER_ID, 'SUPPORT'),
        ).rejects.toBeInstanceOf(ConflictException);

        expect(txOrderUpdateMany).not.toHaveBeenCalled();
        expect(applyStockChange).not.toHaveBeenCalled();
        expect(notifyOrderCancelled).not.toHaveBeenCalled();
      },
    );

    it('answers 404 for a missing order', async () => {
      txOrderFindUnique.mockResolvedValueOnce(null);

      await expect(
        service.cancelPending(ORDER_ID, USER_ID, 'SUPPORT'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(txOrderUpdateMany).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates metadata when order is PENDING', async () => {
      const prisma = (
        service as unknown as {
          prisma: {
            order: {
              findUnique: ReturnType<typeof vi.fn>;
              update: ReturnType<typeof vi.fn>;
            };
          };
        }
      ).prisma;
      prisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        orderNumber: 'ORD-0001',
        status: 'PENDING',
        customerName: 'Old Name',
        customerPhone: null,
        notes: null,
        totalAmount: new Prisma.Decimal('14.48'),
        createdById: USER_ID,
        cancelledAt: null,
        createdAt: new Date('2026-10-23T12:00:00Z'),
        updatedAt: new Date('2026-10-23T12:00:00Z'),
      });
      prisma.order.update.mockResolvedValue({
        id: ORDER_ID,
        orderNumber: 'ORD-0001',
        status: 'PENDING',
        customerName: 'New Name',
        customerPhone: '+1234567890',
        notes: 'Updated note',
        totalAmount: new Prisma.Decimal('14.48'),
        createdById: USER_ID,
        cancelledAt: null,
        createdAt: new Date('2026-10-23T12:00:00Z'),
        updatedAt: new Date('2026-10-23T12:00:00Z'),
      });

      const res = await service.update(
        ORDER_ID,
        {
          customerName: 'New Name',
          customerPhone: '+1234567890',
          notes: 'Updated note',
        },
        USER_ID,
      );
      expect(res.customerName).toBe('New Name');
      expect(res.customerPhone).toBe('+1234567890');
      expect(res.notes).toBe('Updated note');
    });

    it('rejects editing when order is not PENDING with UnprocessableEntityException (422)', async () => {
      const prisma = (
        service as unknown as {
          prisma: { order: { findUnique: ReturnType<typeof vi.fn> } };
        }
      ).prisma;
      prisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        status: 'CONFIRMED',
      });

      await expect(
        service.update(ORDER_ID, { customerName: 'New Name' }, USER_ID),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('throws NotFoundException (404) if order does not exist', async () => {
      const prisma = (
        service as unknown as {
          prisma: { order: { findUnique: ReturnType<typeof vi.fn> } };
        }
      ).prisma;
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.update('00000000-0000-4000-8000-000000000000', {}, USER_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('customer-owned orders', () => {
    const CUSTOMER_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
    const CUSTOMER_B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';

    const ownDto = (extra: Record<string, unknown> = {}) =>
      ({
        items: [{ productId: PRODUCT_A, quantity: 2 }],
        recipientName: 'Jane Doe',
        recipientPhone: '+201005551234',
        shippingAddress: '12 Nile Street',
        shippingCity: 'Cairo',
        ...extra,
      }) as never;

    const customerRow = (customerId: string | null = CUSTOMER_A) => ({
      id: ORDER_ID,
      orderNumber: 'ORD-0001',
      status: 'PENDING',
      totalAmount: new Prisma.Decimal('3.98'),
      recipientName: 'Jane Doe',
      recipientPhone: '+201005551234',
      shippingAddress: '12 Nile Street',
      shippingCity: 'Cairo',
      paymentMethod: 'COD',
      createdAt: new Date('2026-10-23T12:00:00Z'),
      cancelledAt: null,
      customerId,
      orderItems: [
        {
          productName: 'Ballpoint Pen',
          sku: 'OFF-PEN-002',
          quantity: 2,
          unitPrice: new Prisma.Decimal('1.99'),
          lineTotal: new Prisma.Decimal('3.98'),
        },
      ],
    });

    const CUSTOMER_KEYS = [
      'cancelledAt',
      'createdAt',
      'id',
      'items',
      'orderNumber',
      'paymentMethod',
      'recipientName',
      'recipientPhone',
      'shippingAddress',
      'shippingCity',
      'status',
      'totalAmount',
    ];

    it('createMine stamps ownership and recipient details from the token and drops client prices', async () => {
      const result = await service.createMine(
        ownDto({
          items: [{ productId: PRODUCT_A, quantity: 2, unitPrice: 0.01 }],
        }),
        CUSTOMER_A,
        'CUSTOMER',
      );

      expect(txOrderCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          customerId: CUSTOMER_A,
          createdById: CUSTOMER_A,
          customerName: 'Jane Doe',
          customerPhone: '+201005551234',
          recipientName: 'Jane Doe',
          recipientPhone: '+201005551234',
          shippingAddress: '12 Nile Street',
          shippingCity: 'Cairo',
          notes: undefined,
          status: OrderStatus.PENDING,
        }),
        select: expect.anything(),
      });
      // 2 × 1.99 — the client price is ignored.
      expect(result.totalAmount).toBe(3.98);
      expect(result.items[0]).toMatchObject({
        productName: 'Ballpoint Pen',
        sku: 'OFF-PEN-002',
        quantity: 2,
        unitPrice: 1.99,
        lineTotal: 3.98,
      });
      expect(Object.keys(result).sort()).toEqual(CUSTOMER_KEYS);
      expect(result).not.toHaveProperty('createdById');
      expect(result).not.toHaveProperty('customerId');
      expect(result).not.toHaveProperty('stockMovements');
    });

    it('createMine alerts STAFF and ADMIN (never SUPPORT or customers)', async () => {
      await service.createMine(ownDto(), CUSTOMER_A, 'CUSTOMER');

      expect(notifyOrderCreated).toHaveBeenCalledWith(
        {
          id: ORDER_ID,
          orderNumber: 'ORD-0001',
          totalAmount: 3.98,
        },
        { roles: [UserRole.STAFF, UserRole.ADMIN] },
      );
    });

    it('createMine reuses the ONE Serializable transaction and SALE stock write', async () => {
      await service.createMine(ownDto(), CUSTOMER_A, 'CUSTOMER');

      expect($transaction).toHaveBeenCalledTimes(1);
      expect($transaction.mock.calls[0][1]).toEqual({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
      expect(applyStockChange).toHaveBeenCalledWith(
        tx,
        PRODUCT_A,
        -2,
        StockMovementType.SALE,
        null,
        CUSTOMER_A,
        'CUSTOMER',
        { orderId: ORDER_ID },
      );
    });

    it('createMine rejects duplicate product lines with 400 before any transaction', async () => {
      await expect(
        service.createMine(
          ownDto({
            items: [
              { productId: PRODUCT_A, quantity: 1 },
              { productId: PRODUCT_A, quantity: 2 },
            ],
          }),
          CUSTOMER_A,
          'CUSTOMER',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect($transaction).not.toHaveBeenCalled();
    });

    it('createMine rejects inactive products with 422 (shared validation)', async () => {
      txProductFindMany.mockResolvedValue([fact({ isActive: false })]);

      await expect(
        service.createMine(ownDto(), CUSTOMER_A, 'CUSTOMER'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(txOrderCreate).not.toHaveBeenCalled();
      expect(applyStockChange).not.toHaveBeenCalled();
    });

    it('findMine scopes by customerId, newest first and filters by status', async () => {
      const prisma = (
        service as unknown as {
          prisma: {
            order: {
              count: ReturnType<typeof vi.fn>;
              findMany: ReturnType<typeof vi.fn>;
            };
          };
        }
      ).prisma;
      prisma.order.count.mockResolvedValue(1);
      prisma.order.findMany.mockResolvedValue([customerRow()]);

      const res = await service.findMine(
        { page: 1, limit: 20, status: 'PENDING' },
        CUSTOMER_A,
      );

      expect(prisma.order.count).toHaveBeenCalledWith({
        where: { customerId: CUSTOMER_A, status: 'PENDING' },
      });
      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { customerId: CUSTOMER_A, status: 'PENDING' },
        skip: 0,
        take: 20,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: expect.anything(),
      });
      expect(res.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
      expect(Object.keys(res.data[0]).sort()).toEqual(CUSTOMER_KEYS);
      expect(res.data[0].totalAmount).toBe(3.98);
      expect(res.data[0]).not.toHaveProperty('createdById');
    });

    it('findMineOne only reads an order owned by the caller (404 for a foreign id)', async () => {
      const prisma = (
        service as unknown as {
          prisma: { order: { findFirst: ReturnType<typeof vi.fn> } };
        }
      ).prisma;
      prisma.order.findFirst.mockResolvedValueOnce(customerRow(CUSTOMER_A));

      const res = await service.findMineOne(ORDER_ID, CUSTOMER_A);
      expect(prisma.order.findFirst).toHaveBeenCalledWith({
        where: { id: ORDER_ID, customerId: CUSTOMER_A },
        select: expect.anything(),
      });
      expect(Object.keys(res).sort()).toEqual(CUSTOMER_KEYS);

      // Another customer's order is indistinguishable from a missing one.
      prisma.order.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.findMineOne(ORDER_ID, CUSTOMER_B),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('cancelMine restores stock exactly once for an owned PENDING order', async () => {
      const updatedAt = new Date('2026-10-23T13:00:00Z');
      txOrderFindUnique.mockResolvedValueOnce({
        id: ORDER_ID,
        orderNumber: 'ORD-0001',
        status: OrderStatus.CANCELLED,
        customerName: 'Jane Doe',
        customerPhone: '+201005551234',
        notes: null,
        totalAmount: new Prisma.Decimal('3.98'),
        customerId: CUSTOMER_A,
        recipientName: 'Jane Doe',
        recipientPhone: '+201005551234',
        shippingAddress: '12 Nile Street',
        shippingCity: 'Cairo',
        paymentMethod: 'COD',
        createdById: CUSTOMER_A,
        cancelledAt: updatedAt,
        createdAt: new Date('2026-10-23T12:00:00Z'),
        updatedAt,
      });
      txOrderItemFindMany.mockResolvedValueOnce([
        { productId: PRODUCT_A, quantity: 2 },
      ]);

      const res = await service.cancelMine(ORDER_ID, CUSTOMER_A, 'CUSTOMER');

      expect(txOrderFindFirst).toHaveBeenCalledWith({
        where: { id: ORDER_ID, customerId: CUSTOMER_A },
        select: expect.anything(),
      });
      expect(txOrderUpdateMany).toHaveBeenCalledWith({
        where: {
          id: ORDER_ID,
          status: OrderStatus.PENDING,
          customerId: CUSTOMER_A,
        },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: expect.any(Date),
        },
      });
      expect(applyStockChange).toHaveBeenCalledTimes(1);
      expect(applyStockChange).toHaveBeenCalledWith(
        tx,
        PRODUCT_A,
        2,
        StockMovementType.RETURN,
        'Cancelled order ORD-0001',
        CUSTOMER_A,
        'CUSTOMER',
        { orderId: ORDER_ID, allowInactive: true },
      );
      expect(res.status).toBe(OrderStatus.CANCELLED);
      expect(res.cancelledAt).toEqual(updatedAt);
      expect(Object.keys(res).sort()).toEqual(CUSTOMER_KEYS);
      expect(notifyOrderCancelled).toHaveBeenCalledTimes(1);
      expect(notifyOrderCancelled).toHaveBeenCalledWith({
        id: ORDER_ID,
        orderNumber: 'ORD-0001',
        totalAmount: 3.98,
        customerId: CUSTOMER_A,
      });
    });

    it('cancelMine answers 409 on a double cancel and never restores stock twice', async () => {
      txOrderFindFirst.mockResolvedValueOnce({
        id: ORDER_ID,
        orderNumber: 'ORD-0001',
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date('2026-10-23T13:00:00Z'),
      });

      await expect(
        service.cancelMine(ORDER_ID, CUSTOMER_A, 'CUSTOMER'),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(txOrderUpdateMany).not.toHaveBeenCalled();
      expect(applyStockChange).not.toHaveBeenCalled();
      expect(notifyOrderCancelled).not.toHaveBeenCalled();
    });

    it('cancelMine answers 404 for another customer’s order and writes nothing', async () => {
      txOrderFindFirst.mockResolvedValueOnce(null);

      await expect(
        service.cancelMine(ORDER_ID, CUSTOMER_B, 'CUSTOMER'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(txOrderFindFirst).toHaveBeenCalledWith({
        where: { id: ORDER_ID, customerId: CUSTOMER_B },
        select: expect.anything(),
      });
      expect(txOrderUpdateMany).not.toHaveBeenCalled();
      expect(applyStockChange).not.toHaveBeenCalled();
    });

    it('cancelMine keeps the concurrent backstop (409, no restore)', async () => {
      txOrderUpdateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.cancelMine(ORDER_ID, CUSTOMER_A, 'CUSTOMER'),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(applyStockChange).not.toHaveBeenCalled();
    });

    it('createMine retries a P2034 conflict once, preserving concurrency safety', async () => {
      const conflict = new PrismaClientKnownRequestError('write conflict', {
        code: 'P2034',
        clientVersion: 'test',
      });
      $transaction
        .mockReset()
        .mockRejectedValueOnce(conflict)
        .mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));

      await expect(
        service.createMine(ownDto(), CUSTOMER_A, 'CUSTOMER'),
      ).resolves.toBeDefined();
      expect($transaction).toHaveBeenCalledTimes(2);
      expect(applyStockChange).toHaveBeenCalledTimes(1);
    });
  });
});
