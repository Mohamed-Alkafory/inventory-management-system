import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import {
  NotificationType,
  UserRole,
} from '../generated/prisma/client.js';
import { type ListNotificationsQueryDto } from './dto/list-notifications.query.dto.js';
import { type UpdatePreferencesDto } from './dto/update-preferences.dto.js';
import { NotificationsService } from './notifications.service.js';

const USER_ID = 'uuuuuuuu-uuuu-4uuu-8uuu-uuuuuuuuuuuu';
const OTHER_USER_ID = 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx';
const ADMIN_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ADMIN_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CUSTOMER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const STAFF_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const SUPPORT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const CONTACT_MESSAGE_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const PRODUCT_ID = 'pppppppp-pppp-4ppp-8ppp-pppppppppppp';
const ORDER_ID = 'oooooooo-oooo-4ooo-8ooo-oooooooooooo';
const PURCHASE_ORDER_ID = 'qqqqqqqq-qqqq-4qqq-8qqq-qqqqqqqqqqqq';
const NOTIFICATION_ID = '11111111-1111-4111-8111-111111111111';

const notificationRow = (overrides: Record<string, unknown> = {}) => ({
  id: NOTIFICATION_ID,
  userId: USER_ID,
  type: NotificationType.LOW_STOCK,
  title: 'Low stock alert',
  message: 'Ballpoint Pen is low on stock.',
  entityType: 'product',
  entityId: PRODUCT_ID,
  data: null,
  isRead: false,
  readAt: null,
  createdAt: new Date('2026-10-24T12:00:00Z'),
  ...overrides,
});

describe('NotificationsService', () => {
  let service: NotificationsService;
  const notificationFindUnique = vi.fn();
  const notificationFindMany = vi.fn();
  const notificationCount = vi.fn();
  const notificationUpdate = vi.fn();
  const notificationUpdateMany = vi.fn();
  const notificationCreateMany = vi.fn();
  const preferenceFindMany = vi.fn();
  const preferenceUpsert = vi.fn();
  const userFindMany = vi.fn();

  beforeEach(async () => {
    notificationFindUnique.mockReset().mockResolvedValue({ userId: USER_ID });
    notificationFindMany.mockReset().mockResolvedValue([]);
    notificationCount.mockReset().mockResolvedValue(0);
    notificationUpdate.mockReset().mockResolvedValue(
      notificationRow({
        isRead: true,
        readAt: new Date('2026-10-24T13:00:00Z'),
      }),
    );
    notificationUpdateMany.mockReset().mockResolvedValue({ count: 0 });
    notificationCreateMany.mockReset().mockResolvedValue({ count: 0 });
    preferenceFindMany.mockReset().mockResolvedValue([]);
    preferenceUpsert.mockReset().mockResolvedValue({ userId: USER_ID });
    userFindMany.mockReset().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: {
            notification: {
              findUnique: notificationFindUnique,
              findMany: notificationFindMany,
              count: notificationCount,
              update: notificationUpdate,
              updateMany: notificationUpdateMany,
              createMany: notificationCreateMany,
            },
            notificationPreference: {
              findMany: preferenceFindMany,
              upsert: preferenceUpsert,
            },
            user: { findMany: userFindMany },
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('findAll — own notifications only', () => {
    it('forces the userId filter and applies the defaults', async () => {
      notificationCount.mockResolvedValue(1);
      notificationFindMany.mockResolvedValue([notificationRow()]);

      const result = await service.findAll(
        USER_ID,
        {} as ListNotificationsQueryDto,
      );

      expect(notificationCount).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
      expect(notificationFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID },
          skip: 0,
          take: 20,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        }),
      );
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
      expect(result.data).toEqual([notificationRow()]);
    });

    it('filters by type and unread', async () => {
      await service.findAll(USER_ID, {
        type: NotificationType.ORDER_CREATED,
        unread: true,
      } as ListNotificationsQueryDto);

      expect(notificationFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: USER_ID,
            type: NotificationType.ORDER_CREATED,
            isRead: false,
          },
        }),
      );
    });

    it('unread=false lists only the already-read rows', async () => {
      await service.findAll(USER_ID, {
        unread: false,
      } as ListNotificationsQueryDto);

      expect(notificationFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID, isRead: true },
        }),
      );
    });

    it('applies the whitelisted sort fields', async () => {
      await service.findAll(USER_ID, {
        sortBy: 'type',
        sortOrder: 'asc',
      } as ListNotificationsQueryDto);

      expect(notificationFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ type: 'asc' }, { id: 'asc' }] }),
      );
    });
  });

  describe('unreadCount', () => {
    it('counts only the current user’s unread rows', async () => {
      notificationCount.mockResolvedValue(3);

      await expect(service.unreadCount(USER_ID)).resolves.toEqual({ count: 3 });
      expect(notificationCount).toHaveBeenCalledWith({
        where: { userId: USER_ID, isRead: false },
      });
    });
  });

  describe('markRead — ownership enforced', () => {
    it('marks an own notification read with a readAt timestamp', async () => {
      notificationFindUnique.mockResolvedValue({ userId: USER_ID });

      const result = await service.markRead(USER_ID, NOTIFICATION_ID);

      expect(notificationUpdate).toHaveBeenCalledWith({
        where: { id: NOTIFICATION_ID },
        data: { isRead: true, readAt: expect.any(Date) },
        select: expect.objectContaining({ id: true, isRead: true }),
      });
      expect(result.isRead).toBe(true);
    });

    it('404s a missing notification before any update', async () => {
      notificationFindUnique.mockResolvedValue(null);

      await expect(
        service.markRead(USER_ID, NOTIFICATION_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(notificationUpdate).not.toHaveBeenCalled();
    });

    it('404s a notification owned by someone else (not-own is indistinguishable)', async () => {
      notificationFindUnique.mockResolvedValue({ userId: OTHER_USER_ID });

      await expect(
        service.markRead(USER_ID, NOTIFICATION_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(notificationUpdate).not.toHaveBeenCalled();
    });
  });

  describe('markAllRead', () => {
    it('updates only unread rows and reports the count', async () => {
      notificationUpdateMany.mockResolvedValue({ count: 4 });

      await expect(service.markAllRead(USER_ID)).resolves.toEqual({
        updated: 4,
      });
      expect(notificationUpdateMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, isRead: false },
        data: { isRead: true, readAt: expect.any(Date) },
      });
    });
  });

  describe('preferences', () => {
    it('fills the enabled=true default for types without stored rows', async () => {
      preferenceFindMany.mockResolvedValue([
        { type: NotificationType.SYSTEM, enabled: false },
      ]);

      const result = await service.getPreferences(USER_ID);

      expect(result).toEqual([
        { type: NotificationType.LOW_STOCK, enabled: true },
        { type: NotificationType.ORDER_CREATED, enabled: true },
        { type: NotificationType.ORDER_CONFIRMED, enabled: true },
        { type: NotificationType.ORDER_CANCELLED, enabled: true },
        { type: NotificationType.PURCHASE_ORDER_RECEIVED, enabled: true },
        { type: NotificationType.CONTACT_MESSAGE_RECEIVED, enabled: true },
        { type: NotificationType.SYSTEM, enabled: false },
      ]);
    });

    it('upserts each row with the composite key, then returns the full list', async () => {
      preferenceFindMany.mockResolvedValue([
        { type: NotificationType.LOW_STOCK, enabled: false },
      ]);
      const dto = {
        preferences: [{ type: NotificationType.LOW_STOCK, enabled: false }],
      } as UpdatePreferencesDto;

      const result = await service.updatePreferences(USER_ID, dto);

      expect(preferenceUpsert).toHaveBeenCalledWith({
        where: {
          userId_type: { userId: USER_ID, type: NotificationType.LOW_STOCK },
        },
        create: {
          userId: USER_ID,
          type: NotificationType.LOW_STOCK,
          enabled: false,
        },
        update: { enabled: false },
      });
      expect(result).toEqual([
        { type: NotificationType.LOW_STOCK, enabled: false },
        { type: NotificationType.ORDER_CREATED, enabled: true },
        { type: NotificationType.ORDER_CONFIRMED, enabled: true },
        { type: NotificationType.ORDER_CANCELLED, enabled: true },
        { type: NotificationType.PURCHASE_ORDER_RECEIVED, enabled: true },
        { type: NotificationType.CONTACT_MESSAGE_RECEIVED, enabled: true },
        { type: NotificationType.SYSTEM, enabled: true },
      ]);
    });
  });

  describe('notifyLowStockIfDepleted (#31 no-duplicate rule)', () => {
    it('does nothing while stock stays above minStock', async () => {
      await service.notifyLowStockIfDepleted({
        id: PRODUCT_ID,
        name: 'Ballpoint Pen',
        quantity: 60,
        minStock: 50,
      });

      expect(userFindMany).not.toHaveBeenCalled();
      expect(notificationCreateMany).not.toHaveBeenCalled();
    });

    it('alerts every active ADMIN when the product drops to/below minStock', async () => {
      userFindMany.mockResolvedValue([{ id: ADMIN_1 }, { id: ADMIN_2 }]);

      await service.notifyLowStockIfDepleted({
        id: PRODUCT_ID,
        name: 'Ballpoint Pen',
        quantity: 3,
        minStock: 50,
      });

      expect(userFindMany).toHaveBeenCalledWith({
        where: { role: { in: ['ADMIN'] }, isActive: true },
        select: { id: true },
      });
      expect(notificationCreateMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            userId: ADMIN_1,
            type: NotificationType.LOW_STOCK,
            entityType: 'product',
            entityId: PRODUCT_ID,
          }),
          expect.objectContaining({
            userId: ADMIN_2,
            type: NotificationType.LOW_STOCK,
            entityType: 'product',
            entityId: PRODUCT_ID,
          }),
        ],
      });
    });

    it('never duplicates while an unread alert for the same product exists', async () => {
      userFindMany.mockResolvedValue([{ id: ADMIN_1 }, { id: ADMIN_2 }]);
      notificationFindMany.mockResolvedValue([{ userId: ADMIN_1 }]);

      await service.notifyLowStockIfDepleted({
        id: PRODUCT_ID,
        name: 'Ballpoint Pen',
        quantity: 3,
        minStock: 50,
      });

      // ADMIN_1 already holds the unread alert — only ADMIN_2 is notified.
      expect(notificationFindMany).toHaveBeenCalledWith({
        where: {
          userId: { in: [ADMIN_1, ADMIN_2] },
          type: NotificationType.LOW_STOCK,
          isRead: false,
          entityType: 'product',
          entityId: PRODUCT_ID,
        },
        select: { userId: true },
      });
      expect(notificationCreateMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ userId: ADMIN_2 })],
      });
    });

    it('respects users who turned the type off in their preferences', async () => {
      userFindMany.mockResolvedValue([{ id: ADMIN_1 }, { id: ADMIN_2 }]);
      preferenceFindMany.mockResolvedValue([{ userId: ADMIN_1 }]);

      await service.notifyLowStockIfDepleted({
        id: PRODUCT_ID,
        name: 'Ballpoint Pen',
        quantity: 3,
        minStock: 50,
      });

      expect(notificationCreateMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ userId: ADMIN_2 })],
      });
    });

    it('never throws — a failing fan-out is swallowed (main op unaffected)', async () => {
      userFindMany.mockRejectedValue(new Error('db down'));
      await expect(
        service.notifyLowStockIfDepleted({
          id: PRODUCT_ID,
          name: 'Ballpoint Pen',
          quantity: 3,
          minStock: 50,
        }),
      ).resolves.toBeUndefined();

      userFindMany.mockResolvedValue([{ id: ADMIN_1 }]);
      notificationCreateMany.mockRejectedValue(new Error('write failed'));
      await expect(
        service.notifyLowStockIfDepleted({
          id: PRODUCT_ID,
          name: 'Ballpoint Pen',
          quantity: 3,
          minStock: 50,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('order events', () => {
    it('ORDER_CREATED fans out to admins with the order entity linked', async () => {
      userFindMany.mockResolvedValue([{ id: ADMIN_1 }]);

      await service.notifyOrderCreated({
        id: ORDER_ID,
        orderNumber: 'ORD-0001',
        totalAmount: 14.48,
      });

      expect(notificationCreateMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            userId: ADMIN_1,
            type: NotificationType.ORDER_CREATED,
            entityType: 'order',
            entityId: ORDER_ID,
          }),
        ],
      });
    });

    it('ORDER_CANCELLED fans out to admins referencing the order', async () => {
      userFindMany.mockResolvedValue([{ id: ADMIN_1 }]);

      await service.notifyOrderCancelled({
        id: ORDER_ID,
        orderNumber: 'ORD-0001',
        totalAmount: 14.48,
      });

      expect(notificationCreateMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            userId: ADMIN_1,
            type: NotificationType.ORDER_CANCELLED,
            entityType: 'order',
            entityId: ORDER_ID,
          }),
        ],
      });
    });

    it('PURCHASE_ORDER_RECEIVED fans out to admins deep-linking the PO (#32)', async () => {
      userFindMany.mockResolvedValue([{ id: ADMIN_1 }]);

      await service.notifyPurchaseOrderReceived({
        id: PURCHASE_ORDER_ID,
        orderNumber: 'PO-0001',
      });

      expect(notificationCreateMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            userId: ADMIN_1,
            type: NotificationType.PURCHASE_ORDER_RECEIVED,
            entityType: 'purchase-order',
            entityId: PURCHASE_ORDER_ID,
          }),
        ],
      });
    });

    it('ORDER_CREATED can target STAFF and ADMIN for a customer order', async () => {
      userFindMany.mockResolvedValue([
        { id: STAFF_ID },
        { id: ADMIN_1 },
      ]);

      await service.notifyOrderCreated(
        {
          id: ORDER_ID,
          orderNumber: 'ORD-0001',
          totalAmount: 14.48,
        },
        { roles: [UserRole.STAFF, UserRole.ADMIN] },
      );

      expect(userFindMany).toHaveBeenCalledWith({
        where: {
          role: { in: [UserRole.STAFF, UserRole.ADMIN] },
          isActive: true,
        },
        select: { id: true },
      });
      expect(notificationCreateMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            userId: STAFF_ID,
            type: NotificationType.ORDER_CREATED,
          }),
          expect.objectContaining({
            userId: ADMIN_1,
            type: NotificationType.ORDER_CREATED,
          }),
        ],
      });
    });

    it('ORDER_CONFIRMED notifies only the owning active customer with safe content', async () => {
      userFindMany.mockResolvedValue([{ id: CUSTOMER_ID }]);

      await service.notifyOrderConfirmed({
        id: ORDER_ID,
        orderNumber: 'ORD-0001',
        customerId: CUSTOMER_ID,
      });

      expect(userFindMany).toHaveBeenCalledWith({
        where: { id: CUSTOMER_ID, isActive: true },
        select: { id: true },
      });
      expect(notificationCreateMany).toHaveBeenCalledWith({
        data: [
          {
            userId: CUSTOMER_ID,
            type: NotificationType.ORDER_CONFIRMED,
            title: 'Order confirmed',
            message: 'Order ORD-0001 is now CONFIRMED.',
            entityType: 'order',
            entityId: ORDER_ID,
          },
        ],
      });
    });

    it('ORDER_CONFIRMED skips a staff-created order without a customer', async () => {
      await service.notifyOrderConfirmed({
        id: ORDER_ID,
        orderNumber: 'ORD-0001',
        customerId: null,
      });

      expect(userFindMany).not.toHaveBeenCalled();
      expect(notificationCreateMany).not.toHaveBeenCalled();
    });

    it('ORDER_CANCELLED keeps the ADMIN alert and adds exactly one customer row', async () => {
      userFindMany
        .mockResolvedValueOnce([{ id: ADMIN_1 }])
        .mockResolvedValueOnce([{ id: CUSTOMER_ID }]);

      await service.notifyOrderCancelled({
        id: ORDER_ID,
        orderNumber: 'ORD-0001',
        totalAmount: 14.48,
        customerId: CUSTOMER_ID,
      });

      expect(userFindMany).toHaveBeenNthCalledWith(1, {
        where: { role: { in: [UserRole.ADMIN] }, isActive: true },
        select: { id: true },
      });
      expect(userFindMany).toHaveBeenNthCalledWith(2, {
        where: { id: CUSTOMER_ID, isActive: true },
        select: { id: true },
      });
      expect(notificationCreateMany).toHaveBeenCalledTimes(2);
      expect(notificationCreateMany).toHaveBeenNthCalledWith(1, {
        data: [
          expect.objectContaining({
            userId: ADMIN_1,
            type: NotificationType.ORDER_CANCELLED,
            message: 'Order ORD-0001 was cancelled — stock restored.',
          }),
        ],
      });
      expect(notificationCreateMany).toHaveBeenNthCalledWith(2, {
        data: [
          {
            userId: CUSTOMER_ID,
            type: NotificationType.ORDER_CANCELLED,
            title: 'Order cancelled',
            message: 'Order ORD-0001 is now CANCELLED.',
            entityType: 'order',
            entityId: ORDER_ID,
          },
        ],
      });
    });

    it('respects a customer preference for the status event', async () => {
      userFindMany.mockResolvedValue([{ id: CUSTOMER_ID }]);
      preferenceFindMany.mockResolvedValue([{ userId: CUSTOMER_ID }]);

      await service.notifyOrderConfirmed({
        id: ORDER_ID,
        orderNumber: 'ORD-0001',
        customerId: CUSTOMER_ID,
      });

      expect(preferenceFindMany).toHaveBeenCalledWith({
        where: {
          userId: { in: [CUSTOMER_ID] },
          type: NotificationType.ORDER_CONFIRMED,
          enabled: false,
        },
        select: { userId: true },
      });
      expect(notificationCreateMany).not.toHaveBeenCalled();
    });

    it('order notification failures never escape to the order operation', async () => {
      userFindMany.mockRejectedValue(new Error('db down'));

      await expect(
        service.notifyOrderCreated({
          id: ORDER_ID,
          orderNumber: 'ORD-0001',
          totalAmount: 14.48,
        }),
      ).resolves.toBeUndefined();
      await expect(
        service.notifyOrderConfirmed({
          id: ORDER_ID,
          orderNumber: 'ORD-0001',
          customerId: CUSTOMER_ID,
        }),
      ).resolves.toBeUndefined();
      await expect(
        service.notifyOrderCancelled({
          id: ORDER_ID,
          orderNumber: 'ORD-0001',
          totalAmount: 14.48,
          customerId: CUSTOMER_ID,
        }),
      ).resolves.toBeUndefined();

      userFindMany.mockResolvedValue([{ id: CUSTOMER_ID }]);
      notificationCreateMany.mockRejectedValue(new Error('write failed'));
      await expect(
        service.notifyOrderConfirmed({
          id: ORDER_ID,
          orderNumber: 'ORD-0001',
          customerId: CUSTOMER_ID,
        }),
      ).resolves.toBeUndefined();
    });

    it('CONTACT_MESSAGE_RECEIVED targets active SUPPORT users only', async () => {
      userFindMany.mockResolvedValue([{ id: SUPPORT_ID }]);

      await service.notifyContactMessageReceived({
        id: CONTACT_MESSAGE_ID,
        subject: 'Order question',
      });

      expect(userFindMany).toHaveBeenCalledWith({
        where: { role: { in: [UserRole.SUPPORT] }, isActive: true },
        select: { id: true },
      });
      expect(notificationCreateMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            userId: SUPPORT_ID,
            type: NotificationType.CONTACT_MESSAGE_RECEIVED,
            entityType: 'contact_message',
            entityId: CONTACT_MESSAGE_ID,
          }),
        ],
      });
    });
  });
});
