import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PrismaExceptionFilter } from '../src/common/prisma-exception.filter.js';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter.js';
import { resetDb, disconnectDb } from './db-utils.js';
import {
  NotificationType,
  OrderStatus,
  UserRole,
} from '../src/generated/prisma/client.js';

/**
 * Customer-facing notification fan-out against the real database: role
 * targeting, active-user filtering, preference opt-outs, customer-safe
 * content and strict per-user ownership of the inbox.
 */
describe('Customer notifications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let staffToken: string;
  let customerAToken: string;
  let customerBToken: string;

  let adminId: string;
  let staffId: string;
  let supportId: string;
  let customerAId: string;
  let customerBId: string;

  let categoryId: string;
  let productId: string;

  const PASSWORD = 'Password123!';

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(
      new PrismaExceptionFilter(),
      new AllExceptionsFilter(),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await disconnectDb();
    await app.close();
  });

  beforeEach(async () => {
    await resetDb();

    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    const createUser = (
      name: string,
      email: string,
      role: UserRole,
      isActive = true,
    ) =>
      prisma.user.create({
        data: { name, email, passwordHash, role, isActive },
      });

    adminId = (
      await createUser('Admin', 'admin@example.com', UserRole.ADMIN)
    ).id;
    staffId = (
      await createUser('Staff', 'staff@example.com', UserRole.STAFF)
    ).id;
    supportId = (
      await createUser('Support', 'support@example.com', UserRole.SUPPORT)
    ).id;
    customerAId = (
      await createUser('Customer A', 'customer-a@example.com', UserRole.CUSTOMER)
    ).id;
    customerBId = (
      await createUser('Customer B', 'customer-b@example.com', UserRole.CUSTOMER)
    ).id;
    // Inactive recipients must never receive any fan-out.
    await createUser(
      'Inactive Staff',
      'inactive-staff@example.com',
      UserRole.STAFF,
      false,
    );
    await createUser(
      'Inactive Admin',
      'inactive-admin@example.com',
      UserRole.ADMIN,
      false,
    );

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
      return res.body.accessToken as string;
    };

    adminToken = await login('admin@example.com');
    staffToken = await login('staff@example.com');
    customerAToken = await login('customer-a@example.com');
    customerBToken = await login('customer-b@example.com');

    const category = await prisma.category.create({
      data: { name: 'Notifications' },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: 'Notification Item',
        sku: 'NOTE-001',
        price: 10,
        quantity: 100,
        categoryId,
      },
    });
    productId = product.id;
  });

  const createOwnOrder = (token: string) =>
    request(app.getHttpServer())
      .post('/api/v1/orders/mine')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId, quantity: 1 }],
        recipientName: 'Alice Customer',
        recipientPhone: '+201005551234',
        shippingAddress: '12 Nile Street',
        shippingCity: 'Cairo',
      });

  const createStaffOrder = () =>
    request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        items: [{ productId, quantity: 1 }],
        customerName: 'Walk-in customer',
      });

  const confirm = (orderId: string) =>
    request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newStatus: OrderStatus.CONFIRMED });

  const cancel = (orderId: string) =>
    request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newStatus: OrderStatus.CANCELLED });

  it('notifies active STAFF and ADMIN for a customer order only', async () => {
    const created = await createOwnOrder(customerAToken).expect(201);

    const notifications = await prisma.notification.findMany({
      where: { type: NotificationType.ORDER_CREATED },
      orderBy: { userId: 'asc' },
    });

    expect(notifications.map((row) => row.userId).sort()).toEqual(
      [adminId, staffId].sort(),
    );
    for (const row of notifications) {
      expect(row).toMatchObject({
        type: NotificationType.ORDER_CREATED,
        entityType: 'order',
        entityId: created.body.id,
      });
      expect(row.userId).not.toBe(supportId);
      expect(row.userId).not.toBe(customerAId);
      expect(row.userId).not.toBe(customerBId);
    }
  });

  it('notifies the customer exactly once on confirmation and skips walk-in orders', async () => {
    const customerOrder = await createOwnOrder(customerAToken).expect(201);
    await confirm(customerOrder.body.id).expect(200);

    let confirmed = await prisma.notification.findMany({
      where: {
        userId: customerAId,
        type: NotificationType.ORDER_CONFIRMED,
      },
    });
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0]).toMatchObject({
      title: 'Order confirmed',
      message: `Order ${customerOrder.body.orderNumber} is now CONFIRMED.`,
      entityType: 'order',
      entityId: customerOrder.body.id,
    });
    expect(confirmed[0].message).not.toMatch(/stock|laptop|staff/i);

    // A staff-created order has no customerId, so no customer is notified.
    const staffOrder = await createStaffOrder().expect(201);
    await confirm(staffOrder.body.id).expect(200);

    confirmed = await prisma.notification.findMany({
      where: { type: NotificationType.ORDER_CONFIRMED },
    });
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0].userId).toBe(customerAId);
  });

  it('notifies the owning customer once when an admin cancels, keeping the admin alert', async () => {
    const created = await createOwnOrder(customerAToken).expect(201);
    await cancel(created.body.id).expect(200);

    const cancelled = await prisma.notification.findMany({
      where: { type: NotificationType.ORDER_CANCELLED },
      orderBy: { userId: 'asc' },
    });

    expect(cancelled).toHaveLength(2);
    expect(cancelled.map((row) => row.userId).sort()).toEqual(
      [adminId, customerAId].sort(),
    );
    const customerRow = cancelled.find((row) => row.userId === customerAId);
    expect(customerRow).toMatchObject({
      title: 'Order cancelled',
      message: `Order ${created.body.orderNumber} is now CANCELLED.`,
      entityType: 'order',
      entityId: created.body.id,
    });
  });

  it('respects the customer’s notification preference', async () => {
    const created = await createOwnOrder(customerAToken).expect(201);

    await request(app.getHttpServer())
      .put('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        preferences: [
          { type: NotificationType.ORDER_CONFIRMED, enabled: false },
        ],
      })
      .expect(200);

    await confirm(created.body.id).expect(200);

    const confirmed = await prisma.notification.findMany({
      where: {
        userId: customerAId,
        type: NotificationType.ORDER_CONFIRMED,
      },
    });
    expect(confirmed).toHaveLength(0);
  });

  it('never lets customer A read or mark customer B’s notifications', async () => {
    const bOrder = await createOwnOrder(customerBToken).expect(201);
    await confirm(bOrder.body.id).expect(200);

    const bNotification = await prisma.notification.findFirstOrThrow({
      where: {
        userId: customerBId,
        type: NotificationType.ORDER_CONFIRMED,
      },
    });

    const aList = await request(app.getHttpServer())
      .get('/api/v1/notifications?type=ORDER_CONFIRMED')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);
    expect(aList.body.data).toHaveLength(0);

    await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${bNotification.id}/read`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);

    const unchanged = await prisma.notification.findUniqueOrThrow({
      where: { id: bNotification.id },
    });
    expect(unchanged.isRead).toBe(false);
    expect(unchanged.readAt).toBeNull();
  });
});
