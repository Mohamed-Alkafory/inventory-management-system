import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PurchaseOrdersController } from './purchase-orders.controller.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto.js';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto.js';
import { ListPurchaseOrdersQueryDto } from './dto/list-purchase-orders.query.dto.js';
import { UpdatePurchaseOrderStatusDto } from './dto/update-status.dto.js';
import { PERMISSIONS_KEY } from '../auth/decorators/require-permission.decorator.js';

const PO_ID = '22222222-2222-4222-8222-222222222222';
const PRODUCT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ADMIN = {
  sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'ADMIN',
} as const;
const STAFF = {
  sub: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  role: 'STAFF',
} as const;

const detail = {
  id: PO_ID,
  orderNumber: 'PO-0001',
  supplierId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  status: 'DRAFT',
  totalAmount: 6.97,
  expectedAt: null,
  receivedAt: null,
  notes: null,
  createdById: ADMIN.sub,
  createdAt: new Date('2026-10-24T12:00:00Z'),
  updatedAt: new Date('2026-10-24T12:00:00Z'),
  supplier: {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    companyName: 'Office Depot',
  },
  items: [],
};

describe('PurchaseOrdersController', () => {
  let controller: PurchaseOrdersController;
  let reflector: Reflector;
  const findAll = vi.fn();
  const findOne = vi.fn();
  const create = vi.fn();
  const updateStatus = vi.fn();
  const receive = vi.fn();

  beforeEach(async () => {
    findAll.mockReset().mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    findOne.mockReset().mockResolvedValue(detail);
    create.mockReset().mockResolvedValue(detail);
    updateStatus
      .mockReset()
      .mockResolvedValue({ ...detail, status: 'ORDERED' });
    receive.mockReset().mockResolvedValue({ ...detail, status: 'RECEIVED' });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseOrdersController],
      providers: [
        {
          provide: PurchaseOrdersService,
          useValue: { findAll, findOne, create, updateStatus, receive },
        },
      ],
    }).compile();

    controller = module.get<PurchaseOrdersController>(PurchaseOrdersController);
    reflector = module.get(Reflector);
  });

  it('passes the list query through', async () => {
    const query = { status: 'ORDERED' } as ListPurchaseOrdersQueryDto;
    await controller.findAll(query);
    expect(findAll).toHaveBeenCalledWith(query);
  });

  it('passes the id through for detail', async () => {
    await controller.findOne(PO_ID);
    expect(findOne).toHaveBeenCalledWith(PO_ID);
  });

  it('creates with the current user as creator', async () => {
    const dto = {
      supplierId: detail.supplierId,
      items: [],
    } as unknown as CreatePurchaseOrderDto;
    await controller.create(dto, ADMIN);
    expect(create).toHaveBeenCalledWith(dto, ADMIN.sub);
  });

  it('transitions status with the id and body', async () => {
    const dto = { newStatus: 'ORDERED' } as UpdatePurchaseOrderStatusDto;
    await controller.updateStatus(PO_ID, dto);
    expect(updateStatus).toHaveBeenCalledWith(PO_ID, dto);
  });

  it('receives with the current user identity', async () => {
    const dto = {
      items: [{ productId: PRODUCT_A, quantity: 5 }],
    } as ReceivePurchaseOrderDto;
    await controller.receive(PO_ID, dto, STAFF);
    expect(receive).toHaveBeenCalledWith(PO_ID, dto, STAFF.sub, STAFF.role);
  });

  it('guards creation and status changes with po.* permissions, reads and receive with their own', () => {
    const permissionsFor = (handler: (...args: never[]) => unknown) =>
      reflector.get<string[]>(PERMISSIONS_KEY, handler);

    expect(
      permissionsFor(PurchaseOrdersController.prototype.create),
    ).toEqual(['po.create']);
    expect(
      permissionsFor(PurchaseOrdersController.prototype.updateStatus),
    ).toEqual(['po.update_status']);

    expect(
      permissionsFor(PurchaseOrdersController.prototype.findAll),
    ).toEqual(['po.read']);
    expect(
      permissionsFor(PurchaseOrdersController.prototype.findOne),
    ).toEqual(['po.read']);
    expect(
      permissionsFor(PurchaseOrdersController.prototype.receive),
    ).toEqual(['po.receive']);
  });

  describe('input validation (400)', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    const createBody = (value: unknown) =>
      pipe.transform(value, { type: 'body', metatype: CreatePurchaseOrderDto });
    const receiveBody = (value: unknown) =>
      pipe.transform(value, {
        type: 'body',
        metatype: ReceivePurchaseOrderDto,
      });

    it.each([
      [
        'a missing supplierId',
        { items: [{ productId: PRODUCT_A, quantityOrdered: 1, unitCost: 1 }] },
      ],
      ['an empty items array', { supplierId: detail.supplierId, items: [] }],
      [
        'a zero quantityOrdered',
        {
          supplierId: detail.supplierId,
          items: [{ productId: PRODUCT_A, quantityOrdered: 0, unitCost: 1 }],
        },
      ],
      [
        'a negative unitCost',
        {
          supplierId: detail.supplierId,
          items: [{ productId: PRODUCT_A, quantityOrdered: 1, unitCost: -1 }],
        },
      ],
      [
        'a non-uuid productId',
        {
          supplierId: detail.supplierId,
          items: [{ productId: 'nope', quantityOrdered: 1, unitCost: 1 }],
        },
      ],
      [
        'an unknown field',
        {
          supplierId: detail.supplierId,
          items: [{ productId: PRODUCT_A, quantityOrdered: 1, unitCost: 1 }],
          nope: true,
        },
      ],
    ] as const)('rejects %s on create', async (_name, body) => {
      await expect(createBody(body)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('accepts a valid create body', async () => {
      await expect(
        createBody({
          supplierId: detail.supplierId,
          items: [{ productId: PRODUCT_A, quantityOrdered: 2, unitCost: 0.6 }],
        }),
      ).resolves.toMatchObject({ supplierId: detail.supplierId });
    });

    it.each([
      ['an empty receive body', {}],
      ['an empty item list', { items: [] }],
      [
        'a zero receive quantity',
        { items: [{ productId: PRODUCT_A, quantity: 0 }] },
      ],
      [
        'a duplicate-free but malformed product',
        { items: [{ productId: 'nope', quantity: 1 }] },
      ],
    ] as const)('rejects %s on receive', async (_name, body) => {
      await expect(receiveBody(body)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('accepts a valid receive body', async () => {
      await expect(
        receiveBody({ items: [{ productId: PRODUCT_A, quantity: 3 }] }),
      ).resolves.toMatchObject({
        items: [{ productId: PRODUCT_A, quantity: 3 }],
      });
    });
  });
});
