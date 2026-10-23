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
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';

const PRODUCT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PRODUCT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER_ID_FAKE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';

const ADMIN = { sub: 'admin-id', role: 'ADMIN' } as const;
const STAFF = { sub: 'staff-id', role: 'STAFF' } as const;

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

describe('OrdersController', () => {
  let controller: OrdersController;
  let reflector: Reflector;
  const create = vi.fn();
  const updateStatus = vi.fn();

  beforeEach(async () => {
    create.mockReset().mockResolvedValue(sampleCreated);
    updateStatus
      .mockReset()
      .mockResolvedValue({ ...sampleCreated, status: 'CONFIRMED' });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        { provide: OrdersService, useValue: { create, updateStatus } },
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

  it('uses the documented metadata — any role, POST default 201', () => {
    const handler = OrdersController.prototype.create;

    expect(reflector.get<string[]>(ROLES_KEY, handler) ?? []).toEqual([]);
    expect(reflector.get<string[]>(ROLES_KEY, handler)).toBeUndefined();

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

    it('uses the documented metadata — any role, PATCH default 200', () => {
      const handler = OrdersController.prototype.updateStatus;

      expect(reflector.get<string[]>(ROLES_KEY, handler) ?? []).toEqual([]);
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
});
