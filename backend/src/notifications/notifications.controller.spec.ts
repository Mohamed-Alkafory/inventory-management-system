import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { ListNotificationsQueryDto } from './dto/list-notifications.query.dto.js';
import { UpdatePreferencesDto } from './dto/update-preferences.dto.js';
import { PERMISSIONS_KEY } from '../auth/decorators/require-permission.decorator.js';
import { ANY_AUTHENTICATED_KEY } from '../auth/decorators/any-authenticated.decorator.js';
import { NotificationType } from '../generated/prisma/enums.js';

const USER = {
  sub: 'uuuuuuuu-uuuu-4uuu-8uuu-uuuuuuuuuuuu',
  role: 'STAFF',
} as const;
const ADMIN = {
  sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'ADMIN',
} as const;
const NOTIFICATION_ID = '11111111-1111-4111-8111-111111111111';

const sampleNotification = {
  id: NOTIFICATION_ID,
  userId: USER.sub,
  type: NotificationType.LOW_STOCK,
  title: 'Low stock alert',
  message: 'Ballpoint Pen is low on stock.',
  entityType: 'product',
  entityId: 'pppppppp-pppp-4ppp-8ppp-pppppppppppp',
  data: null,
  isRead: false,
  readAt: null,
  createdAt: new Date('2026-10-24T12:00:00Z'),
};

const samplePage = {
  data: [sampleNotification],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let reflector: Reflector;
  const findAll = vi.fn();
  const unreadCount = vi.fn();
  const markRead = vi.fn();
  const markAllRead = vi.fn();
  const getPreferences = vi.fn();
  const updatePreferences = vi.fn();

  beforeEach(async () => {
    findAll.mockReset().mockResolvedValue(samplePage);
    unreadCount.mockReset().mockResolvedValue({ count: 2 });
    markRead
      .mockReset()
      .mockResolvedValue({ ...sampleNotification, isRead: true });
    markAllRead.mockReset().mockResolvedValue({ updated: 2 });
    getPreferences.mockReset().mockResolvedValue([
      { type: NotificationType.LOW_STOCK, enabled: true },
      { type: NotificationType.ORDER_CREATED, enabled: true },
      { type: NotificationType.ORDER_CANCELLED, enabled: true },
      { type: NotificationType.PURCHASE_ORDER_RECEIVED, enabled: true },
      { type: NotificationType.SYSTEM, enabled: true },
    ]);
    updatePreferences
      .mockReset()
      .mockImplementation(async (_userId, dto) =>
        dto.preferences.map((p) => ({ type: p.type, enabled: p.enabled })),
      );

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: {
            findAll,
            unreadCount,
            markRead,
            markAllRead,
            getPreferences,
            updatePreferences,
          },
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    reflector = module.get(Reflector);
  });

  it('lists the current user’s notifications (ownership forced by the service)', async () => {
    const query = { page: 2, unread: true } as ListNotificationsQueryDto;

    await expect(controller.findAll(query, ADMIN)).resolves.toBe(samplePage);
    expect(findAll).toHaveBeenCalledWith(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      query,
    );
  });

  it('counts unread rows for the current user', async () => {
    await expect(controller.unreadCount(ADMIN)).resolves.toEqual({ count: 2 });
    expect(unreadCount).toHaveBeenCalledWith(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
  });

  it('marks one notification read and marks all read', async () => {
    await controller.markRead(NOTIFICATION_ID, ADMIN);

    expect(markRead).toHaveBeenCalledWith(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      NOTIFICATION_ID,
    );

    await controller.markAllRead(USER);

    expect(markAllRead).toHaveBeenCalledWith(
      'uuuuuuuu-uuuu-4uuu-8uuu-uuuuuuuuuuuu',
    );
  });

  it('returns the preference list and passes updates through', async () => {
    await controller.getPreferences(USER);
    expect(getPreferences).toHaveBeenCalledWith(
      'uuuuuuuu-uuuu-4uuu-8uuu-uuuuuuuuuuuu',
    );

    const dto = {
      preferences: [{ type: 'SYSTEM', enabled: false }],
    } as UpdatePreferencesDto;
    await controller.updatePreferences(dto, USER);
    expect(updatePreferences).toHaveBeenCalledWith(
      'uuuuuuuu-uuuu-4uuu-8uuu-uuuuuuuuuuuu',
      dto,
    );
  });

  it('propagates the 404 for reading another user’s notification', async () => {
    markRead.mockRejectedValue(
      new NotFoundException(`Notification ${NOTIFICATION_ID} not found`),
    );

    await expect(
      controller.markRead(NOTIFICATION_ID, ADMIN),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps every endpoint open to any authenticated user (ownership is the boundary)', () => {
    expect(
      reflector.get<boolean>(ANY_AUTHENTICATED_KEY, NotificationsController),
    ).toBe(true);

    const handlers = [
      NotificationsController.prototype.findAll,
      NotificationsController.prototype.unreadCount,
      NotificationsController.prototype.markAllRead,
      NotificationsController.prototype.markRead,
      NotificationsController.prototype.getPreferences,
      NotificationsController.prototype.updatePreferences,
    ];

    for (const handler of handlers) {
      expect(
        reflector.get<boolean>(ANY_AUTHENTICATED_KEY, handler),
      ).toBeUndefined();
      expect(reflector.get<string[]>(PERMISSIONS_KEY, handler)).toBeUndefined();
      // All routes are GET/PATCH/PUT — NestJS defaults to 200 (no __httpCode__).
      expect(Reflect.getMetadata('__httpCode__', handler)).toBeUndefined();
    }
  });

  describe('input validation (400) — preferences body', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    const validate = (value: unknown) =>
      pipe.transform(value, { type: 'body', metatype: UpdatePreferencesDto });

    it.each([
      ['a body without preferences', {}],
      ['a non-array preferences field', { preferences: 'all off' }],
      ['an empty preferences array', { preferences: [] }],
      [
        'more than 5 rows',
        {
          preferences: Array.from({ length: 6 }, () => ({
            type: 'SYSTEM',
            enabled: true,
          })),
        },
      ],
      [
        'an unknown notification type',
        { preferences: [{ type: 'MAGIC', enabled: true }] },
      ],
      [
        'a non-boolean enabled flag',
        { preferences: [{ type: 'SYSTEM', enabled: 'no' }] },
      ],
      ['a row without enabled', { preferences: [{ type: 'SYSTEM' }] }],
    ] as const)('rejects %s with 400', async (_name, body) => {
      await expect(validate(body)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a valid preferences batch', async () => {
      await expect(
        validate({
          preferences: [
            { type: 'SYSTEM', enabled: false },
            { type: 'LOW_STOCK', enabled: true },
          ],
        }),
      ).resolves.toMatchObject({
        preferences: [
          { type: 'SYSTEM', enabled: false },
          { type: 'LOW_STOCK', enabled: true },
        ],
      });
    });
  });

  describe('input validation (400) — list query', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const validate = (value: unknown) =>
      pipe.transform(value, {
        type: 'query',
        metatype: ListNotificationsQueryDto,
      });

    it.each([
      ['an invalid type', { type: 'MAGIC' }],
      ['a non-boolean unread', { unread: 'maybe' }],
      ['page below 1', { page: 0 }],
      ['limit above 100', { limit: 101 }],
      ['an invalid sortBy', { sortBy: 'title' }],
      ['an invalid sortOrder', { sortOrder: 'up' }],
      ['an unknown param', { q: 'low' }],
    ] as const)('rejects %s with 400', async (_name, bad) => {
      await expect(validate(bad)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a valid query with type + unread filters', async () => {
      const transformed = await validate({
        type: 'LOW_STOCK',
        unread: 'true',
      });

      expect(transformed).toMatchObject({
        type: NotificationType.LOW_STOCK,
        unread: true,
        page: 1,
        limit: 20,
      });
    });
  });
});
