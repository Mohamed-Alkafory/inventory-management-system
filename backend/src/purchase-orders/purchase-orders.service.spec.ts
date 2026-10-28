import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, PurchaseOrderStatus } from '../generated/prisma/client.js';
import { StockMovementType } from '../generated/prisma/enums.js';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { StockService } from '../stock/stock.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';
import type { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto.js';
import type { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto.js';
import type { ListPurchaseOrdersQueryDto } from './dto/list-purchase-orders.query.dto.js';

const USER_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const SUPPLIER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PRODUCT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PRODUCT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PO_ID = '22222222-2222-4222-8222-222222222222';

const createDto = (
  overrides: Partial<CreatePurchaseOrderDto> = {},
): CreatePurchaseOrderDto =>
  ({
    supplierId: SUPPLIER_ID,
    items: [
      { productId: PRODUCT_A, quantityOrdered: 3, unitCost: 1.99 },
      { productId: PRODUCT_B, quantityOrdered: 2, unitCost: 0.5 },
    ],
    ...overrides,
  }) as CreatePurchaseOrderDto;

const receiveDto = (
  items: Array<{ productId: string; quantity: number }>,
): ReceivePurchaseOrderDto => ({ items }) as ReceivePurchaseOrderDto;

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;
  const $transaction = vi.fn();
  const txSupplierFindUnique = vi.fn();
  const txProductFindMany = vi.fn();
  const txPurchaseOrderCount = vi.fn();
  const txPurchaseOrderCreate = vi.fn();
  const txPurchaseOrderFindUnique = vi.fn();
  const txPurchaseOrderUpdateMany = vi.fn();
  const txPurchaseOrderItemFindMany = vi.fn();
  const txPurchaseOrderItemUpdateMany = vi.fn();
  const purchaseOrderCount = vi.fn();
  const purchaseOrderFindMany = vi.fn();
  const purchaseOrderFindUnique = vi.fn();
  const applyStockChange = vi.fn();
  const notifyPurchaseOrderReceived = vi.fn();

  const tx = {
    supplier: { findUnique: txSupplierFindUnique },
    product: { findMany: txProductFindMany },
    purchaseOrder: {
      count: txPurchaseOrderCount,
      create: txPurchaseOrderCreate,
      findUnique: txPurchaseOrderFindUnique,
      updateMany: txPurchaseOrderUpdateMany,
    },
    purchaseOrderItem: {
      findMany: txPurchaseOrderItemFindMany,
      updateMany: txPurchaseOrderItemUpdateMany,
    },
  };

  /** Full PO_DETAIL_SELECT-shaped row the service re-reads after writes. */
  const detailRow = (
    status: PurchaseOrderStatus,
    receivedA = 0,
    receivedB = 0,
  ) => ({
    id: PO_ID,
    orderNumber: 'PO-0001',
    supplierId: SUPPLIER_ID,
    status,
    totalAmount: new Prisma.Decimal('6.97'),
    expectedAt: null,
    receivedAt:
      status === PurchaseOrderStatus.RECEIVED
        ? new Date('2026-10-24T15:00:00Z')
        : null,
    notes: null,
    createdById: USER_ID,
    createdAt: new Date('2026-10-23T12:00:00Z'),
    updatedAt: new Date('2026-10-24T15:00:00Z'),
    supplier: { id: SUPPLIER_ID, companyName: 'Office Depot' },
    items: [
      {
        id: 'line-a',
        purchaseOrderId: PO_ID,
        productId: PRODUCT_A,
        quantityOrdered: 10,
        quantityReceived: receivedA,
        unitCost: new Prisma.Decimal('1.99'),
        product: { id: PRODUCT_A, name: 'Ballpoint Pen', sku: 'OFF-PEN-002' },
      },
      {
        id: 'line-b',
        purchaseOrderId: PO_ID,
        productId: PRODUCT_B,
        quantityOrdered: 4,
        quantityReceived: receivedB,
        unitCost: new Prisma.Decimal('0.5'),
        product: { id: PRODUCT_B, name: 'Stapler', sku: 'OFF-STA-003' },
      },
    ],
  });

  beforeEach(async () => {
    $transaction
      .mockReset()
      .mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
    txSupplierFindUnique.mockReset().mockResolvedValue({
      id: SUPPLIER_ID,
      companyName: 'Office Depot',
      isActive: true,
    });
    txProductFindMany.mockReset().mockResolvedValue([
      { id: PRODUCT_A, isActive: true },
      { id: PRODUCT_B, isActive: true },
    ]);
    txPurchaseOrderCount.mockReset().mockResolvedValue(0);
    txPurchaseOrderCreate
      .mockReset()
      .mockResolvedValue(detailRow(PurchaseOrderStatus.DRAFT));
    // First call: the narrow transition/receive validation read; later
    // calls: the detail re-read after the write.
    txPurchaseOrderFindUnique
      .mockReset()
      .mockResolvedValueOnce({
        id: PO_ID,
        orderNumber: 'PO-0001',
        status: 'DRAFT',
      })
      .mockResolvedValue(detailRow(PurchaseOrderStatus.DRAFT));
    txPurchaseOrderUpdateMany.mockReset().mockResolvedValue({ count: 1 });
    txPurchaseOrderItemFindMany.mockReset().mockResolvedValue([
      {
        id: 'line-a',
        productId: PRODUCT_A,
        quantityOrdered: 10,
        quantityReceived: 0,
      },
      {
        id: 'line-b',
        productId: PRODUCT_B,
        quantityOrdered: 4,
        quantityReceived: 0,
      },
    ]);
    txPurchaseOrderItemUpdateMany.mockReset().mockResolvedValue({ count: 1 });
    purchaseOrderCount.mockReset().mockResolvedValue(0);
    purchaseOrderFindMany.mockReset().mockResolvedValue([]);
    purchaseOrderFindUnique
      .mockReset()
      .mockResolvedValue(detailRow(PurchaseOrderStatus.DRAFT));
    applyStockChange.mockReset().mockResolvedValue({
      movement: { id: 'movement-id' },
      product: { id: PRODUCT_A },
    });
    notifyPurchaseOrderReceived.mockReset().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        {
          provide: PrismaService,
          useValue: {
            $transaction,
            purchaseOrder: {
              count: purchaseOrderCount,
              findMany: purchaseOrderFindMany,
              findUnique: purchaseOrderFindUnique,
            },
          },
        },
        { provide: StockService, useValue: { applyStockChange } },
        { provide: AuditService, useValue: { log: vi.fn() } },
        {
          provide: NotificationsService,
          useValue: { notifyPurchaseOrderReceived },
        },
      ],
    }).compile();

    service = module.get<PurchaseOrdersService>(PurchaseOrdersService);
  });

  describe('findAll', () => {
    it('applies the pagination defaults and no filters', async () => {
      const result = await service.findAll({} as ListPurchaseOrdersQueryDto);

      expect(purchaseOrderCount).toHaveBeenCalledWith({ where: {} });
      expect(purchaseOrderFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          skip: 0,
          take: 20,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        }),
      );
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
    });

    it('filters by status and supplier and sorts by whitelisted fields', async () => {
      await service.findAll({
        status: PurchaseOrderStatus.ORDERED,
        supplierId: SUPPLIER_ID,
        sortBy: 'status',
        sortOrder: 'asc',
      } as ListPurchaseOrdersQueryDto);

      expect(purchaseOrderFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: PurchaseOrderStatus.ORDERED,
            supplierId: SUPPLIER_ID,
          },
          orderBy: [{ status: 'asc' }, { id: 'asc' }],
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns the detail with items and supplier', async () => {
      const result = await service.findOne(PO_ID);

      expect(purchaseOrderFindUnique).toHaveBeenCalledWith({
        where: { id: PO_ID },
        select: expect.objectContaining({
          supplier: expect.anything(),
          items: expect.anything(),
        }),
      });
      expect(result.supplier).toEqual({
        id: SUPPLIER_ID,
        companyName: 'Office Depot',
      });
      expect(result.items).toHaveLength(2);
      expect(result.items[0].unitCost).toBe(1.99);
    });

    it('404s a missing purchase order', async () => {
      purchaseOrderFindUnique.mockReset().mockResolvedValue(null);

      await expect(service.findOne(PO_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create — one Serializable transaction', () => {
    it('creates PO-0001 with decimal-computed totals and nested items', async () => {
      const result = await service.create(createDto(), USER_ID);

      expect($transaction).toHaveBeenCalledTimes(1);
      expect(txPurchaseOrderCount).toHaveBeenCalledWith();
      expect(txPurchaseOrderCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderNumber: 'PO-0001',
            supplierId: SUPPLIER_ID,
            status: PurchaseOrderStatus.DRAFT,
            createdById: USER_ID,
            totalAmount: new Prisma.Decimal('6.97'),
            items: {
              create: [
                {
                  productId: PRODUCT_A,
                  quantityOrdered: 3,
                  unitCost: new Prisma.Decimal('1.99'),
                },
                {
                  productId: PRODUCT_B,
                  quantityOrdered: 2,
                  unitCost: new Prisma.Decimal('0.5'),
                },
              ],
            },
          }),
        }),
      );
      expect(result.orderNumber).toBe('PO-0001');
      expect(result.status).toBe(PurchaseOrderStatus.DRAFT);
      expect(result.totalAmount).toBe(6.97);
      expect(result.items[0].unitCost).toBe(1.99);
      // Creating a PO never touches stock.
      expect(applyStockChange).not.toHaveBeenCalled();
    });

    it('generates PO-0007 when six orders already exist', async () => {
      txPurchaseOrderCount.mockResolvedValue(6);

      await service.create(createDto(), USER_ID);

      expect(txPurchaseOrderCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ orderNumber: 'PO-0007' }),
        }),
      );
    });

    it('passes expectedAt and notes through', async () => {
      await service.create(
        createDto({
          expectedAt: '2026-11-15T00:00:00.000Z',
          notes: 'Restock for November',
        }),
        USER_ID,
      );

      expect(txPurchaseOrderCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expectedAt: '2026-11-15T00:00:00.000Z',
            notes: 'Restock for November',
          }),
        }),
      );
    });

    it('404s a missing supplier before anything is written', async () => {
      txSupplierFindUnique.mockResolvedValue(null);

      await expect(service.create(createDto(), USER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(txPurchaseOrderCreate).not.toHaveBeenCalled();
    });

    it('422s an inactive supplier', async () => {
      txSupplierFindUnique.mockResolvedValue({
        id: SUPPLIER_ID,
        companyName: 'Office Depot',
        isActive: false,
      });

      await expect(service.create(createDto(), USER_ID)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(txPurchaseOrderCreate).not.toHaveBeenCalled();
    });

    it('400s duplicate productId lines before any transaction opens', async () => {
      await expect(
        service.create(
          createDto({
            items: [
              { productId: PRODUCT_A, quantityOrdered: 1, unitCost: 1 },
              { productId: PRODUCT_A, quantityOrdered: 2, unitCost: 1 },
            ],
          }),
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect($transaction).not.toHaveBeenCalled();
    });

    it('404s a product line that does not exist', async () => {
      txProductFindMany.mockResolvedValue([{ id: PRODUCT_A, isActive: true }]);

      await expect(service.create(createDto(), USER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('422s an inactive product line', async () => {
      txProductFindMany.mockResolvedValue([
        { id: PRODUCT_A, isActive: true },
        { id: PRODUCT_B, isActive: false },
      ]);

      await expect(service.create(createDto(), USER_ID)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(txPurchaseOrderCreate).not.toHaveBeenCalled();
    });

    it('retries once on a P2002 orderNumber race and then succeeds', async () => {
      const p2002 = new PrismaClientKnownRequestError('orderNumber conflict', {
        code: 'P2002',
        clientVersion: 'test',
      });
      txPurchaseOrderCreate
        .mockReset()
        .mockRejectedValueOnce(p2002)
        .mockResolvedValue(detailRow(PurchaseOrderStatus.DRAFT));

      const result = await service.create(createDto(), USER_ID);

      expect(txPurchaseOrderCreate).toHaveBeenCalledTimes(2);
      expect(result.orderNumber).toBe('PO-0001');
    });
  });

  describe('updateStatus — manual transitions only', () => {
    it('DRAFT → ORDERED writes conditionally on the validated status', async () => {
      const result = await service.updateStatus(PO_ID, {
        newStatus: PurchaseOrderStatus.ORDERED,
      } as never);

      expect(txPurchaseOrderUpdateMany).toHaveBeenCalledWith({
        where: { id: PO_ID, status: PurchaseOrderStatus.DRAFT },
        data: { status: PurchaseOrderStatus.ORDERED },
      });
      expect(result.status).toBe(PurchaseOrderStatus.DRAFT); // detail re-read mock
    });

    it('DRAFT → CANCELLED is allowed', async () => {
      txPurchaseOrderFindUnique
        .mockReset()
        .mockResolvedValueOnce({
          id: PO_ID,
          orderNumber: 'PO-0001',
          status: 'DRAFT',
        })
        .mockResolvedValue(detailRow(PurchaseOrderStatus.CANCELLED));

      await expect(
        service.updateStatus(PO_ID, {
          newStatus: PurchaseOrderStatus.CANCELLED,
        } as never),
      ).resolves.toBeDefined();
      expect(txPurchaseOrderUpdateMany).toHaveBeenCalledWith({
        where: { id: PO_ID, status: PurchaseOrderStatus.DRAFT },
        data: { status: PurchaseOrderStatus.CANCELLED },
      });
    });

    it('ORDERED → CANCELLED is allowed', async () => {
      txPurchaseOrderFindUnique
        .mockReset()
        .mockResolvedValueOnce({
          id: PO_ID,
          orderNumber: 'PO-0001',
          status: 'ORDERED',
        })
        .mockResolvedValue(detailRow(PurchaseOrderStatus.CANCELLED));

      await expect(
        service.updateStatus(PO_ID, {
          newStatus: PurchaseOrderStatus.CANCELLED,
        } as never),
      ).resolves.toBeDefined();
    });

    it('rejects ORDERED → PARTIALLY_RECEIVED with 409 (receiving only)', async () => {
      txPurchaseOrderFindUnique.mockReset().mockResolvedValue({
        id: PO_ID,
        orderNumber: 'PO-0001',
        status: 'ORDERED',
      });

      await expect(
        service.updateStatus(PO_ID, {
          newStatus: PurchaseOrderStatus.PARTIALLY_RECEIVED,
        } as never),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(txPurchaseOrderUpdateMany).not.toHaveBeenCalled();
    });

    it('rejects ORDERED → RECEIVED with 409 (receiving only)', async () => {
      txPurchaseOrderFindUnique.mockReset().mockResolvedValue({
        id: PO_ID,
        orderNumber: 'PO-0001',
        status: 'ORDERED',
      });

      await expect(
        service.updateStatus(PO_ID, {
          newStatus: PurchaseOrderStatus.RECEIVED,
        } as never),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects re-touching the current status with 409', async () => {
      await expect(
        service.updateStatus(PO_ID, {
          newStatus: PurchaseOrderStatus.DRAFT,
        } as never),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects PARTIALLY_RECEIVED → CANCELLED with 409 (receiving state)', async () => {
      txPurchaseOrderFindUnique.mockReset().mockResolvedValue({
        id: PO_ID,
        orderNumber: 'PO-0001',
        status: 'PARTIALLY_RECEIVED',
      });

      await expect(
        service.updateStatus(PO_ID, {
          newStatus: PurchaseOrderStatus.CANCELLED,
        } as never),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('a cancelled purchase order is terminal (409)', async () => {
      txPurchaseOrderFindUnique.mockReset().mockResolvedValue({
        id: PO_ID,
        orderNumber: 'PO-0001',
        status: 'CANCELLED',
      });

      await expect(
        service.updateStatus(PO_ID, {
          newStatus: PurchaseOrderStatus.ORDERED,
        } as never),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(txPurchaseOrderUpdateMany).not.toHaveBeenCalled();
    });

    it('404s a missing purchase order', async () => {
      txPurchaseOrderFindUnique.mockReset().mockResolvedValue(null);

      await expect(
        service.updateStatus(PO_ID, {
          newStatus: PurchaseOrderStatus.ORDERED,
        } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('409s when the conditional write loses a concurrent change', async () => {
      txPurchaseOrderUpdateMany.mockReset().mockResolvedValue({ count: 0 });

      await expect(
        service.updateStatus(PO_ID, {
          newStatus: PurchaseOrderStatus.ORDERED,
        } as never),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('retries once on a P2034 write conflict', async () => {
      const conflict = new PrismaClientKnownRequestError('write conflict', {
        code: 'P2034',
        clientVersion: 'test',
      });
      $transaction
        .mockReset()
        .mockRejectedValueOnce(conflict)
        .mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));

      await expect(
        service.updateStatus(PO_ID, {
          newStatus: PurchaseOrderStatus.ORDERED,
        } as never),
      ).resolves.toBeDefined();
      expect($transaction).toHaveBeenCalledTimes(2);
    });
  });

  describe('receive — full, partial and rejected', () => {
    it('fully receives the order: RECEIVED + receivedAt + stock + movements + notification', async () => {
      txPurchaseOrderFindUnique
        .mockReset()
        .mockResolvedValueOnce({
          id: PO_ID,
          orderNumber: 'PO-0001',
          status: 'ORDERED',
        })
        .mockResolvedValue(detailRow(PurchaseOrderStatus.RECEIVED, 10, 4));
      txPurchaseOrderItemFindMany
        .mockReset()
        .mockResolvedValueOnce([
          {
            id: 'line-a',
            productId: PRODUCT_A,
            quantityOrdered: 10,
            quantityReceived: 0,
          },
          {
            id: 'line-b',
            productId: PRODUCT_B,
            quantityOrdered: 4,
            quantityReceived: 0,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'line-a',
            productId: PRODUCT_A,
            quantityOrdered: 10,
            quantityReceived: 10,
          },
          {
            id: 'line-b',
            productId: PRODUCT_B,
            quantityOrdered: 4,
            quantityReceived: 4,
          },
        ]);

      const result = await service.receive(
        PO_ID,
        receiveDto([
          { productId: PRODUCT_A, quantity: 10 },
          { productId: PRODUCT_B, quantity: 4 },
        ]),
        USER_ID,
        'STAFF',
      );

      expect(txPurchaseOrderItemUpdateMany).toHaveBeenCalledWith({
        where: { id: 'line-a' },
        data: { quantityReceived: { increment: 10 } },
      });
      expect(txPurchaseOrderItemUpdateMany).toHaveBeenCalledWith({
        where: { id: 'line-b' },
        data: { quantityReceived: { increment: 4 } },
      });
      expect(applyStockChange).toHaveBeenCalledTimes(2);
      expect(applyStockChange).toHaveBeenCalledWith(
        tx,
        PRODUCT_A,
        10,
        StockMovementType.PURCHASE_RECEIPT,
        'Received purchase order PO-0001',
        USER_ID,
        'STAFF',
        { purchaseOrderId: PO_ID },
      );
      expect(applyStockChange).toHaveBeenCalledWith(
        tx,
        PRODUCT_B,
        4,
        StockMovementType.PURCHASE_RECEIPT,
        'Received purchase order PO-0001',
        USER_ID,
        'STAFF',
        { purchaseOrderId: PO_ID },
      );
      expect(txPurchaseOrderUpdateMany).toHaveBeenCalledWith({
        where: { id: PO_ID, status: PurchaseOrderStatus.ORDERED },
        data: {
          status: PurchaseOrderStatus.RECEIVED,
          receivedAt: expect.any(Date),
        },
      });
      expect(result.status).toBe(PurchaseOrderStatus.RECEIVED);
      expect(notifyPurchaseOrderReceived).toHaveBeenCalledWith({
        id: PO_ID,
        orderNumber: 'PO-0001',
      });
    });

    it('a partially received PO stays PARTIALLY_RECEIVED without receivedAt', async () => {
      txPurchaseOrderFindUnique
        .mockReset()
        .mockResolvedValueOnce({
          id: PO_ID,
          orderNumber: 'PO-0001',
          status: 'ORDERED',
        })
        .mockResolvedValue(
          detailRow(PurchaseOrderStatus.PARTIALLY_RECEIVED, 4, 0),
        );
      txPurchaseOrderItemFindMany.mockReset().mockResolvedValue([
        // re-read after the line writes: line A took 4 of 10, line B still 0
        {
          id: 'line-a',
          productId: PRODUCT_A,
          quantityOrdered: 10,
          quantityReceived: 4,
        },
        {
          id: 'line-b',
          productId: PRODUCT_B,
          quantityOrdered: 4,
          quantityReceived: 0,
        },
      ]);

      const result = await service.receive(
        PO_ID,
        receiveDto([{ productId: PRODUCT_A, quantity: 4 }]),
        USER_ID,
        'ADMIN',
      );

      expect(txPurchaseOrderUpdateMany).toHaveBeenCalledWith({
        where: { id: PO_ID, status: 'ORDERED' },
        data: { status: PurchaseOrderStatus.PARTIALLY_RECEIVED },
      });
      expect(result.status).toBe(PurchaseOrderStatus.PARTIALLY_RECEIVED);
      expect(notifyPurchaseOrderReceived).toHaveBeenCalledTimes(1);
    });

    it('a second receive that completes the order stamps RECEIVED + receivedAt', async () => {
      // First (narrow) read: PARTIALLY_RECEIVED with line A already in.
      txPurchaseOrderFindUnique
        .mockReset()
        .mockResolvedValueOnce({
          id: PO_ID,
          orderNumber: 'PO-0001',
          status: 'PARTIALLY_RECEIVED',
        })
        .mockResolvedValue(detailRow(PurchaseOrderStatus.RECEIVED, 10, 4));
      txPurchaseOrderItemFindMany
        .mockReset()
        .mockResolvedValueOnce([
          {
            id: 'line-a',
            productId: PRODUCT_A,
            quantityOrdered: 10,
            quantityReceived: 10,
          },
          {
            id: 'line-b',
            productId: PRODUCT_B,
            quantityOrdered: 4,
            quantityReceived: 0,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'line-a',
            productId: PRODUCT_A,
            quantityOrdered: 10,
            quantityReceived: 10,
          },
          {
            id: 'line-b',
            productId: PRODUCT_B,
            quantityOrdered: 4,
            quantityReceived: 4,
          },
        ]);

      const result = await service.receive(
        PO_ID,
        receiveDto([{ productId: PRODUCT_B, quantity: 4 }]),
        USER_ID,
        'ADMIN',
      );

      expect(txPurchaseOrderUpdateMany).toHaveBeenCalledWith({
        where: { id: PO_ID, status: 'PARTIALLY_RECEIVED' },
        data: {
          status: PurchaseOrderStatus.RECEIVED,
          receivedAt: expect.any(Date),
        },
      });
      expect(result.status).toBe(PurchaseOrderStatus.RECEIVED);
    });

    it('rejects over-receiving beyond the remaining quantity with 409', async () => {
      await expect(
        service.receive(
          PO_ID,
          receiveDto([{ productId: PRODUCT_B, quantity: 5 }]), // remaining 4
          USER_ID,
          'ADMIN',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(txPurchaseOrderItemUpdateMany).not.toHaveBeenCalled();
      expect(applyStockChange).not.toHaveBeenCalled();
    });

    it('rejects receiving into an already partially over-received line (409)', async () => {
      txPurchaseOrderItemFindMany.mockReset().mockResolvedValue([
        {
          id: 'line-a',
          productId: PRODUCT_A,
          quantityOrdered: 10,
          quantityReceived: 9,
        },
      ]);

      await expect(
        service.receive(
          PO_ID,
          receiveDto([{ productId: PRODUCT_A, quantity: 2 }]), // remaining 1
          USER_ID,
          'ADMIN',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('400s a product that is not a line of the purchase order', async () => {
      txPurchaseOrderFindUnique.mockReset().mockResolvedValue({
        id: PO_ID,
        orderNumber: 'PO-0001',
        status: 'ORDERED',
      });

      await expect(
        service.receive(
          PO_ID,
          receiveDto([
            { productId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', quantity: 1 },
          ]),
          USER_ID,
          'ADMIN',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(applyStockChange).not.toHaveBeenCalled();
    });

    it('400s duplicate productId lines in the receive body', async () => {
      txPurchaseOrderFindUnique.mockReset().mockResolvedValue({
        id: PO_ID,
        orderNumber: 'PO-0001',
        status: 'ORDERED',
      });

      await expect(
        service.receive(
          PO_ID,
          receiveDto([
            { productId: PRODUCT_A, quantity: 1 },
            { productId: PRODUCT_A, quantity: 2 },
          ]),
          USER_ID,
          'ADMIN',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('409s a DRAFT purchase order (order it first)', async () => {
      await expect(
        service.receive(
          PO_ID,
          receiveDto([{ productId: PRODUCT_A, quantity: 1 }]),
          USER_ID,
          'ADMIN',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(txPurchaseOrderItemUpdateMany).not.toHaveBeenCalled();
    });

    it('409s a CANCELLED purchase order', async () => {
      txPurchaseOrderFindUnique.mockReset().mockResolvedValue({
        id: PO_ID,
        orderNumber: 'PO-0001',
        status: 'CANCELLED',
      });

      await expect(
        service.receive(
          PO_ID,
          receiveDto([{ productId: PRODUCT_A, quantity: 1 }]),
          USER_ID,
          'ADMIN',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(applyStockChange).not.toHaveBeenCalled();
    });

    it('409s an already RECEIVED purchase order', async () => {
      txPurchaseOrderFindUnique.mockReset().mockResolvedValue({
        id: PO_ID,
        orderNumber: 'PO-0001',
        status: 'RECEIVED',
      });

      await expect(
        service.receive(
          PO_ID,
          receiveDto([{ productId: PRODUCT_A, quantity: 1 }]),
          USER_ID,
          'ADMIN',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(applyStockChange).not.toHaveBeenCalled();
    });

    it('404s a missing purchase order before any write', async () => {
      txPurchaseOrderFindUnique.mockReset().mockResolvedValue(null);

      await expect(
        service.receive(
          PO_ID,
          receiveDto([{ productId: PRODUCT_A, quantity: 1 }]),
          USER_ID,
          'ADMIN',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(txPurchaseOrderItemUpdateMany).not.toHaveBeenCalled();
      expect(applyStockChange).not.toHaveBeenCalled();
      expect(notifyPurchaseOrderReceived).not.toHaveBeenCalled();
    });

    it('a failing stock write aborts the receive (no partial data leaves the tx)', async () => {
      txPurchaseOrderFindUnique
        .mockReset()
        .mockResolvedValueOnce({
          id: PO_ID,
          orderNumber: 'PO-0001',
          status: 'ORDERED',
        })
        .mockResolvedValue(
          detailRow(PurchaseOrderStatus.PARTIALLY_RECEIVED, 5, 0),
        );
      applyStockChange
        .mockReset()
        .mockResolvedValueOnce({
          movement: { id: 'm1' },
          product: { id: PRODUCT_A },
        })
        .mockRejectedValueOnce(
          new UnprocessableEntityException('Product B is inactive'),
        );

      await expect(
        service.receive(
          PO_ID,
          receiveDto([
            { productId: PRODUCT_A, quantity: 5 },
            { productId: PRODUCT_B, quantity: 2 },
          ]),
          USER_ID,
          'ADMIN',
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      // Both line updates ran, then the second stock write failed; in the
      // real DB the Serializable transaction rolls every write back — the
      // notification (post-commit) never fires for a failed receive.
      expect(txPurchaseOrderItemUpdateMany).toHaveBeenCalledTimes(2);
      expect(notifyPurchaseOrderReceived).not.toHaveBeenCalled();
    });

    it('retries once on a P2034 write conflict during receive', async () => {
      const conflict = new PrismaClientKnownRequestError('write conflict', {
        code: 'P2034',
        clientVersion: 'test',
      });
      txPurchaseOrderFindUnique
        .mockReset()
        .mockResolvedValueOnce({
          id: PO_ID,
          orderNumber: 'PO-0001',
          status: 'ORDERED',
        })
        .mockResolvedValue(
          detailRow(PurchaseOrderStatus.PARTIALLY_RECEIVED, 10, 0),
        );
      $transaction
        .mockReset()
        .mockRejectedValueOnce(conflict)
        .mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));

      await expect(
        service.receive(
          PO_ID,
          receiveDto([{ productId: PRODUCT_A, quantity: 10 }]),
          USER_ID,
          'ADMIN',
        ),
      ).resolves.toBeDefined();
      expect($transaction).toHaveBeenCalledTimes(2);
    });
  });
});
