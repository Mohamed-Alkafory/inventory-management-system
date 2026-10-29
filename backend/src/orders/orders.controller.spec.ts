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

import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { CreateOwnOrderDto } from './dto/create-own-order.dto.js';
import { CreateOrderNoteDto } from './dto/create-order-note.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { PERMISSIONS_KEY } from '../auth/decorators/require-permission.decorator.js';

const PRODUCT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PRODUCT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER_ID_FAKE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';

const ADMIN = { sub: 'admin-id', role: 'ADMIN' } as const;
const STAFF = { sub: 'staff-id', role: 'STAFF' } as const;
const CUSTOMER = { sub: 'customer-id', role: 'CUSTOMER' } as const;

const sampleCreated = {
  id: '22222222-2222-4222-8222-222222222222',
  orderNumber: 'ORD-0001',
  status: 'PENDING',
  customerName: 'Walk-in customer',
  customerPhone: null,
  notes: null,
  totalAmount: 14.48,
  createdById: 'admin-id',
  cancelledAt: null,
  createdAt: new Date('2026-10-23T12:00:00Z'),
  updatedAt: new Date('2026-10-23T12:00:00Z'),
  items: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      orderId: '22222222-2222-4222-8222-222222222222',
      productId: PRODUCT_A,
      productName: 'Ballpoint Pen',
      sku: 'OFF-PEN-002',
      quantity: 2,
      unitPrice: 1.99,
      lineTotal: 3.98,
    },
  ],
};

const sampleCustomerOrder = {
  id: '22222222-2222-4222-8222-222222222222',
  orderNumber: 'ORD-0001',
  status: 'PENDING',
  totalAmount: 3.98,
  items: [
    {
      productName: 'Ballpoint Pen',
      sku: 'OFF-PEN-002',
      quantity: 2,
      unitPrice: 1.99,
      lineTotal: 3.98,
    },
  ],
  recipientName: 'Jane Doe',
  recipientPhone: '+201005551234',
  shippingAddress: '12 Nile Street',
  shippingCity: 'Cairo',
  paymentMethod: 'COD',
  createdAt: new Date('2026-10-23T12:00:00Z'),
  cancelledAt: null,
};

describe('OrdersController', () => {
  let controller: OrdersController;
  let reflector: Reflector;
  const create = vi.fn();
  const createMine = vi.fn();
  const updateStatus = vi.fn();
  const findAll = vi.fn();
  const findMine = vi.fn();
  const findMineOne = vi.fn();
  const findOne = vi.fn();
  const update = vi.fn();
  const cancelMine = vi.fn();
  const cancelPending = vi.fn();
  const createNote = vi.fn();
  const findNotes = vi.fn();

  beforeEach(async () => {
    create.mockReset().mockResolvedValue(sampleCreated);
    updateStatus
      .mockReset()
      .mockResolvedValue({ ...sampleCreated, status: 'CONFIRMED' });
    findAll.mockReset().mockResolvedValue({
      data: [sampleCreated],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    findOne.mockReset().mockResolvedValue({
      ...sampleCreated,
      createdBy: { id: 'admin-id', name: 'Admin', email: 'admin@example.com' },
      stockMovements: [],
    });
    update.mockReset().mockResolvedValue(sampleCreated);
    createMine.mockReset().mockResolvedValue(sampleCustomerOrder);
    findMine.mockReset().mockResolvedValue({
      data: [sampleCustomerOrder],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    findMineOne.mockReset().mockResolvedValue(sampleCustomerOrder);
    cancelMine
      .mockReset()
      .mockResolvedValue({ ...sampleCustomerOrder, status: 'CANCELLED' });
    cancelPending
      .mockReset()
      .mockResolvedValue({ ...sampleCreated, status: 'CANCELLED' });
    createNote.mockReset().mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      orderId: ORDER_ID,
      authorId: 'staff-id',
      note: 'Internal follow-up',
      author: { id: 'staff-id', name: 'Staff' },
      createdAt: new Date('2026-10-30T12:00:00Z'),
    });
    findNotes.mockReset().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: {
            create,
            createMine,
            updateStatus,
            findAll,
            findMine,
            findMineOne,
            findOne,
            update,
            cancelMine,
            cancelPending,
            createNote,
            findNotes,
          },
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    reflector = module.get(Reflector);
  });

  it('creates the order and returns the created payload', async () => {
    const dto = {
      items: [{ productId: PRODUCT_A, quantity: 2 }],
      customerName: 'Walk-in customer',
    } as CreateOrderDto;

    await expect(controller.create(dto, ADMIN)).resolves.toBe(sampleCreated);
    expect(create).toHaveBeenCalledWith(dto, 'admin-id', 'ADMIN');
  });

  it('passes STAFF identity and role through (any role may sell)', async () => {
    const dto = {
      items: [{ productId: PRODUCT_A, quantity: 1 }],
    } as CreateOrderDto;

    await controller.create(dto, STAFF);

    expect(create).toHaveBeenCalledWith(dto, 'staff-id', 'STAFF');
  });

  it('uses the documented metadata — orders.create, POST default 201', () => {
    const handler = OrdersController.prototype.create;

    expect(reflector.get<string[]>(PERMISSIONS_KEY, handler)).toEqual([
      'orders.create',
    ]);

    // POST endpoints get 201 from NestJS defaults; no __httpCode__ is set.
    expect(Reflect.getMetadata('__httpCode__', handler)).toBeUndefined();
  });

  it('propagates the service 404 / 409 / 422 for order failures', async () => {
    create
      .mockRejectedValueOnce(
        new NotFoundException(`Product ${PRODUCT_A} not found`),
      )
      .mockRejectedValueOnce(new ConflictException('Insufficient stock'))
      .mockRejectedValueOnce(
        new UnprocessableEntityException(`Product ${PRODUCT_A} is inactive`),
      );

    await expect(controller.create({} as never, ADMIN)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(controller.create({} as never, ADMIN)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(controller.create({} as never, ADMIN)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  describe('PATCH /orders/:id/status (issue #29)', () => {
    it('changes the status through the service, passing id path param and user', async () => {
      const dto = { newStatus: 'CONFIRMED' } as UpdateOrderStatusDto;

      await expect(
        controller.updateStatus(ORDER_ID, dto, ADMIN),
      ).resolves.toMatchObject({
        status: 'CONFIRMED',
        orderNumber: 'ORD-0001',
      });
      expect(updateStatus).toHaveBeenCalledWith(
        ORDER_ID,
        dto,
        'admin-id',
        'ADMIN',
      );
    });

    it('passes STAFF identity and role through (any role may manage the till)', async () => {
      await controller.updateStatus(
        ORDER_ID,
        { newStatus: 'CANCELLED' } as UpdateOrderStatusDto,
        STAFF,
      );

      expect(updateStatus).toHaveBeenCalledWith(
        ORDER_ID,
        expect.anything(),
        'staff-id',
        'STAFF',
      );
    });

    it('uses the documented metadata — orders.update_status, PATCH default 200', () => {
      const handler = OrdersController.prototype.updateStatus;

      expect(reflector.get<string[]>(PERMISSIONS_KEY, handler)).toEqual([
        'orders.update_status',
      ]);
      expect(
        Reflect.getMetadata('__httpCode__', handler) ?? HttpStatus.OK,
      ).toBe(HttpStatus.OK);
    });

    it('propagates the service 404 / 409 for invalid transitions', async () => {
      updateStatus
        .mockRejectedValueOnce(
          new NotFoundException(`Order ${ORDER_ID} not found`),
        )
        .mockRejectedValueOnce(
          new ConflictException(
            'Order ORD-0001 cannot transition from CANCELLED to CONFIRMED',
          ),
        );

      await expect(
        controller.updateStatus(ORDER_ID, {} as never, ADMIN),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        controller.updateStatus(ORDER_ID, {} as never, ADMIN),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    describe('input validation (400) — status body', () => {
      const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      });
      const validate = (value: unknown) =>
        pipe.transform(value, { type: 'body', metatype: UpdateOrderStatusDto });

      it.each([
        ['a body without newStatus', {}],
        ['an unknown status value', { newStatus: 'SHIPPED' }],
        [
          'a lowercase status (enums are case-sensitive)',
          { newStatus: 'confirmed' },
        ],
        ['a numeric status', { newStatus: 1 }],
        ['a null status', { newStatus: null }],
      ] as const)('rejects %s with 400', async (_name, body) => {
        await expect(validate(body)).rejects.toBeInstanceOf(
          BadRequestException,
        );
      });

      it('accepts CONFIRMED and CANCELLED (PENDING is enum-valid but answers 409 at the service)', async () => {
        await expect(
          validate({ newStatus: 'CONFIRMED' }),
        ).resolves.toMatchObject({
          newStatus: 'CONFIRMED',
        });
        await expect(
          validate({ newStatus: 'CANCELLED' }),
        ).resolves.toMatchObject({
          newStatus: 'CANCELLED',
        });
        await expect(validate({ newStatus: 'PENDING' })).resolves.toMatchObject(
          {
            newStatus: 'PENDING',
          },
        );
      });
    });
  });

  describe('input validation (400) — POST /orders body', () => {
    // Mirrors the global ValidationPipe configuration from main.ts.
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const validate = (value: unknown) =>
      pipe.transform(value, { type: 'body', metatype: CreateOrderDto });

    it.each([
      ['a body without items', {}],
      [
        'a non-array items field',
        { items: { productId: PRODUCT_A, quantity: 1 } },
      ],
      ['an empty items array', { items: [] }],
      [
        'more than 100 items (ArrayMaxSize)',
        {
          items: Array.from({ length: 101 }, () => ({
            productId: PRODUCT_A,
            quantity: 1,
          })),
        },
      ],
    ] as const)('rejects %s with 400', async (_name, body) => {
      await expect(validate(body)).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each([
      ['an item without productId', [{ quantity: 1 }]],
      [
        'an item with a non-UUID productId',
        [{ productId: 'pen', quantity: 1 }],
      ],
      ['an item with quantity 0', [{ productId: PRODUCT_A, quantity: 0 }]],
      [
        'an item with a negative quantity',
        [{ productId: PRODUCT_A, quantity: -2 }],
      ],
      [
        'an item with a non-integer quantity',
        [{ productId: PRODUCT_A, quantity: 1.5 }],
      ],
      [
        'an item with a non-numeric quantity',
        [{ productId: PRODUCT_A, quantity: 'two' }],
      ],
    ] as const)(
      'rejects an item list containing %s with 400',
      async (_name, badItems) => {
        await expect(validate({ items: badItems })).rejects.toBeInstanceOf(
          BadRequestException,
        );
      },
    );

    it('rejects client-supplied money fields (prices are server-computed)', async () => {
      await expect(
        validate({
          items: [
            { productId: PRODUCT_A, quantity: 1, unitPrice: 1.99 } as never,
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        validate({
          items: [{ productId: PRODUCT_A, quantity: 1 }],
          totalAmount: 99.99,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a spoofed createdById inside an item (client cannot stamp metadata)', async () => {
      await expect(
        validate({
          items: [
            {
              productId: PRODUCT_A,
              quantity: 1,
              createdById: USER_ID_FAKE,
            } as never,
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects over-long optional fields', async () => {
      await expect(
        validate({
          items: [{ productId: PRODUCT_A, quantity: 1 }],
          customerName: 'a'.repeat(101),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        validate({
          items: [{ productId: PRODUCT_A, quantity: 1 }],
          customerPhone: '1'.repeat(21),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        validate({
          items: [{ productId: PRODUCT_A, quantity: 1 }],
          notes: 'n'.repeat(2001),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an empty-string customerName (MinLength)', async () => {
      await expect(
        validate({
          items: [{ productId: PRODUCT_A, quantity: 1 }],
          customerName: '',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts exactly 100 items (upper bound)', async () => {
      const result = await validate({
        items: Array.from({ length: 100 }, () => ({
          productId: PRODUCT_A,
          quantity: 1,
        })),
      });

      expect(result).toBeDefined();
    });

    it('accepts a valid body with optional customer fields', async () => {
      const transformed = (await validate({
        items: [
          { productId: PRODUCT_A, quantity: 2 },
          { productId: PRODUCT_B, quantity: 3 },
        ],
        customerName: 'Walk-in customer',
        customerPhone: '+201005551234',
        notes: 'Delivery after 5 PM',
      })) as Record<string, unknown>;

      expect(transformed).toMatchObject({
        items: [
          { productId: PRODUCT_A, quantity: 2 },
          { productId: PRODUCT_B, quantity: 3 },
        ],
        customerName: 'Walk-in customer',
        customerPhone: '+201005551234',
        notes: 'Delivery after 5 PM',
      });
    });

    it('accepts a minimalist body with only items', async () => {
      const transformed = (await validate({
        items: [{ productId: PRODUCT_A, quantity: 1 }],
      })) as Record<string, unknown>;

      // Optional child fields strip to undefined/absent under whitelist.
      expect(transformed).toEqual({
        items: [{ productId: PRODUCT_A, quantity: 1 }],
      });
    });
  });

  describe('GET /orders', () => {
    it('calls ordersService.findAll with the caller role and returns metadata', async () => {
      const res = await controller.findAll(
        { page: 1, limit: 20 },
        ADMIN,
      );
      expect(findAll).toHaveBeenCalledWith({ page: 1, limit: 20 }, 'ADMIN');
      expect(res.data).toHaveLength(1);
      expect(res.meta.total).toBe(1);
    });

    it('requires orders.read_all to list', () => {
      const handler = OrdersController.prototype.findAll;
      expect(reflector.get<string[]>(PERMISSIONS_KEY, handler)).toEqual([
        'orders.read_all',
      ]);
    });
  });

  describe('GET /orders/:id', () => {
    it('calls ordersService.findOne with the viewer identity', async () => {
      const res = await controller.findOne(ORDER_ID, STAFF);
      expect(findOne).toHaveBeenCalledWith(ORDER_ID, 'staff-id', 'STAFF');
      expect(res.id).toBe(ORDER_ID);
      expect(res.createdBy.email).toBe('admin@example.com');
    });

    it('requires orders.read_all to view details', () => {
      const handler = OrdersController.prototype.findOne;
      expect(reflector.get<string[]>(PERMISSIONS_KEY, handler)).toEqual([
        'orders.read_all',
      ]);
    });
  });

  describe('POST /orders/:id/cancel', () => {
    it('forwards the id and caller to the pending-only cancel service', async () => {
      const res = await controller.cancelPending(ORDER_ID, STAFF);
      expect(cancelPending).toHaveBeenCalledWith(
        ORDER_ID,
        'staff-id',
        'STAFF',
      );
      expect(res.status).toBe('CANCELLED');
    });

    it('requires orders.cancel_pending and defaults to POST 201', () => {
      const handler = OrdersController.prototype.cancelPending;
      expect(reflector.get<string[]>(PERMISSIONS_KEY, handler)).toEqual([
        'orders.cancel_pending',
      ]);
      expect(Reflect.getMetadata('__httpCode__', handler)).toBeUndefined();
    });
  });

  describe('internal order notes', () => {
    it('creates a note with the author from the token', async () => {
      const dto = { note: 'Internal follow-up' } as CreateOrderNoteDto;
      const res = await controller.createNote(ORDER_ID, dto, STAFF);

      expect(createNote).toHaveBeenCalledWith(ORDER_ID, dto, 'staff-id');
      expect(res.note).toBe('Internal follow-up');
    });

    it('lists notes for an order', async () => {
      await expect(controller.findNotes(ORDER_ID)).resolves.toEqual([]);
      expect(findNotes).toHaveBeenCalledWith(ORDER_ID);
    });

    it.each([
      ['createNote', 'orders.notes.write'],
      ['findNotes', 'orders.notes.read'],
    ] as const)('%s requires %s', (method, permission) => {
      const handler = (
        OrdersController.prototype as unknown as Record<string, unknown>
      )[method] as () => void;
      expect(reflector.get<string[]>(PERMISSIONS_KEY, handler)).toEqual([
        permission,
      ]);
    });

    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const validateNote = (value: unknown) =>
      pipe.transform(value, { type: 'body', metatype: CreateOrderNoteDto });

    it('trims a valid note', async () => {
      await expect(
        validateNote({ note: '  Call the customer  ' }),
      ).resolves.toEqual({ note: 'Call the customer' });
    });

    it.each([
      ['blank note', { note: '   ' }],
      ['note over 2000 characters', { note: 'n'.repeat(2001) }],
      ['unknown field', { note: 'ok', authorId: 'someone' }],
    ])('rejects %s with 400', async (_label, payload) => {
      await expect(validateNote(payload)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('PATCH /orders/:id', () => {
    it('calls ordersService.update passing id, dto, and user.sub', async () => {
      const dto = { customerName: 'New Name' };
      const res = await controller.update(ORDER_ID, dto, ADMIN);
      expect(update).toHaveBeenCalledWith(ORDER_ID, dto, 'admin-id');
      expect(res).toBe(sampleCreated);
    });

    it('requires orders.update to edit metadata while PENDING', () => {
      const handler = OrdersController.prototype.update;
      expect(reflector.get<string[]>(PERMISSIONS_KEY, handler)).toEqual([
        'orders.update',
      ]);
    });
  });

  describe('customer-owned order endpoints', () => {
    const validBody = {
      items: [{ productId: PRODUCT_A, quantity: 2 }],
      recipientName: 'Jane Doe',
      recipientPhone: '+201005551234',
      shippingAddress: '12 Nile Street',
      shippingCity: 'Cairo',
      notes: 'Please call on arrival',
    };

    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const validate = (value: unknown) =>
      pipe.transform(value, { type: 'body', metatype: CreateOwnOrderDto });

    it('POST /orders/mine passes the body and the token identity to the service', async () => {
      const dto = validBody as CreateOwnOrderDto;

      await expect(controller.createMine(dto, CUSTOMER)).resolves.toBe(
        sampleCustomerOrder,
      );
      expect(createMine).toHaveBeenCalledWith(dto, 'customer-id', 'CUSTOMER');
    });

    it('GET /orders/mine scopes the query to the current user', async () => {
      const res = await controller.findMine(
        { page: 1, limit: 20, status: 'PENDING' },
        CUSTOMER,
      );

      expect(findMine).toHaveBeenCalledWith(
        { page: 1, limit: 20, status: 'PENDING' },
        'customer-id',
      );
      expect(res.data).toHaveLength(1);
    });

    it('GET /orders/mine/:id passes id and owner to the service', async () => {
      const res = await controller.findMineOne(ORDER_ID, CUSTOMER);
      expect(findMineOne).toHaveBeenCalledWith(ORDER_ID, 'customer-id');
      expect(res.id).toBe(ORDER_ID);
    });

    it('POST /orders/mine/:id/cancel passes id and owner, returns the cancelled order', async () => {
      const res = await controller.cancelMine(ORDER_ID, CUSTOMER);
      expect(cancelMine).toHaveBeenCalledWith(
        ORDER_ID,
        'customer-id',
        'CUSTOMER',
      );
      expect(res.status).toBe('CANCELLED');
    });

    it.each([
      ['POST /orders/mine', 'createMine', 'orders.create_own'],
      ['GET /orders/mine', 'findMine', 'orders.read_own'],
      ['GET /orders/mine/:id', 'findMineOne', 'orders.read_own'],
      ['POST /orders/mine/:id/cancel', 'cancelMine', 'orders.cancel_own'],
    ] as const)('%s requires %s/%s', (_label, method, permission) => {
      const handler = (
        OrdersController.prototype as unknown as Record<string, unknown>
      )[method] as () => void;

      expect(reflector.get<string[]>(PERMISSIONS_KEY, handler)).toEqual([
        permission,
      ]);
    });

    it.each([
      ['a body without items', { ...validBody, items: undefined }],
      [
        'more than 30 items (ArrayMaxSize)',
        {
          ...validBody,
          items: Array.from({ length: 31 }, () => ({
            productId: PRODUCT_A,
            quantity: 1,
          })),
        },
      ],
      [
        'an item quantity above 50',
        { ...validBody, items: [{ productId: PRODUCT_A, quantity: 51 }] },
      ],
      [
        'an item quantity of 0',
        { ...validBody, items: [{ productId: PRODUCT_A, quantity: 0 }] },
      ],
      [
        'a non-integer quantity',
        { ...validBody, items: [{ productId: PRODUCT_A, quantity: 1.5 }] },
      ],
      ['a missing recipientName', { ...validBody, recipientName: undefined }],
      ['a missing recipientPhone', { ...validBody, recipientPhone: undefined }],
      ['a missing shippingAddress', { ...validBody, shippingAddress: undefined }],
      ['a missing shippingCity', { ...validBody, shippingCity: undefined }],
      [
        'a client-sent unitPrice',
        {
          ...validBody,
          items: [{ productId: PRODUCT_A, quantity: 1, unitPrice: 0.01 }],
        },
      ],
      ['a client-sent totalAmount', { ...validBody, totalAmount: 0.01 }],
      ['a client-sent status', { ...validBody, status: 'CONFIRMED' }],
      ['a client-sent customerId', { ...validBody, customerId: USER_ID_FAKE }],
      [
        'a client-sent createdById',
        { ...validBody, createdById: USER_ID_FAKE },
      ],
    ] as const)('rejects %s with 400', async (_label, body) => {
      await expect(validate(body)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts the documented upper bounds (30 distinct lines, quantity 50)', async () => {
      const transformed = (await validate({
        ...validBody,
        items: Array.from({ length: 30 }, () => ({
          productId: PRODUCT_A,
          quantity: 50,
        })),
      })) as Record<string, unknown>;

      expect(transformed).toMatchObject({
        recipientName: 'Jane Doe',
        recipientPhone: '+201005551234',
        shippingAddress: '12 Nile Street',
        shippingCity: 'Cairo',
      });
    });
  });
});
