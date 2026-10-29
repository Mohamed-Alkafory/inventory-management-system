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
  OrderStatus,
  StockMovementType,
  UserRole,
} from '../src/generated/prisma/client.js';

/**
 * Support tooling (internal order notes, PENDING-only cancellation, PII access
 * audit and list minimization) against the real test database, including the
 * actions SUPPORT must never be able to perform.
 */
describe('Support tools (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let customerToken: string;
  let supportToken: string;
  let staffToken: string;
  let adminToken: string;

  let customerId: string;
  let supportId: string;
  let staffId: string;

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

    const customer = await prisma.user.create({
      data: {
        name: 'Alice Customer',
        email: 'customer@example.com',
        passwordHash,
        role: UserRole.CUSTOMER,
      },
    });
    customerId = customer.id;

    const support = await prisma.user.create({
      data: {
        name: 'Support Agent',
        email: 'support@example.com',
        passwordHash,
        role: UserRole.SUPPORT,
      },
    });
    supportId = support.id;

    const staff = await prisma.user.create({
      data: {
        name: 'Staff Member',
        email: 'staff@example.com',
        passwordHash,
        role: UserRole.STAFF,
      },
    });
    staffId = staff.id;

    await prisma.user.create({
      data: {
        name: 'Admin',
        email: 'admin@example.com',
        passwordHash,
        role: UserRole.ADMIN,
      },
    });

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
      return res.body.accessToken as string;
    };

    customerToken = await login('customer@example.com');
    supportToken = await login('support@example.com');
    staffToken = await login('staff@example.com');
    adminToken = await login('admin@example.com');

    const category = await prisma.category.create({
      data: { name: 'Support Tools' },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: 'Support Item',
        sku: 'SUP-001',
        price: 12.5,
        costPrice: 7.5,
        quantity: 10,
        categoryId,
      },
    });
    productId = product.id;
  });

  const createCustomerOrder = async (quantity = 2) => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/orders/mine')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ productId, quantity }],
        recipientName: 'Alice Customer',
        recipientPhone: '+201005551234',
        shippingAddress: '12 Nile Street',
        shippingCity: 'Cairo',
      })
      .expect(201);
    return res.body as { id: string; orderNumber: string };
  };

  const stockOf = async () =>
    (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
      .quantity;

  const viewedAudits = () =>
    prisma.auditLog.findMany({
      where: { action: 'order.viewed' },
      orderBy: { createdAt: 'asc' },
    });

  it('minimizes SUPPORT list rows but returns PII on the audited detail view', async () => {
    const order = await createCustomerOrder();

    const list = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${supportToken}`)
      .expect(200);
    const row = list.body.data[0];
    expect(row.id).toBe(order.id);
    expect(row).not.toHaveProperty('customerPhone');
    expect(row).not.toHaveProperty('recipientPhone');
    expect(row).not.toHaveProperty('shippingAddress');
    // Non-PII context is still available.
    expect(row.customerName).toBe('Alice Customer');
    expect(row.shippingCity).toBe('Cairo');

    // Lists are never audited.
    expect(await viewedAudits()).toHaveLength(0);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.id}`)
      .set('Authorization', `Bearer ${supportToken}`)
      .expect(200);
    expect(detail.body.customerPhone).toBe('+201005551234');
    expect(detail.body.recipientPhone).toBe('+201005551234');
    expect(detail.body.shippingAddress).toBe('12 Nile Street');

    let audits = await viewedAudits();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      userId: supportId,
      action: 'order.viewed',
      entityType: 'order',
      entityId: order.id,
    });
    expect(audits[0].newValues).toMatchObject({
      viewerId: supportId,
      viewerRole: 'SUPPORT',
    });
    // The audit entry itself never stores the personal data.
    const auditPayload = JSON.stringify(audits[0]);
    expect(auditPayload).not.toContain('+201005551234');
    expect(auditPayload).not.toContain('12 Nile Street');

    await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    audits = await viewedAudits();
    expect(audits).toHaveLength(2);
    expect(audits[1]).toMatchObject({ userId: staffId, entityId: order.id });

    // ADMIN detail views and every list call are not audited.
    await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(await viewedAudits()).toHaveLength(2);
  });

  it('keeps internal notes staff-only and never returns them to customers', async () => {
    const order = await createCustomerOrder();

    const created = await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/notes`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ note: '  Customer called about delivery  ' })
      .expect(201);
    expect(created.body).toMatchObject({
      orderId: order.id,
      authorId: supportId,
      note: 'Customer called about delivery',
      author: { id: supportId, name: 'Support Agent' },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/notes`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ note: 'Stock checked, ready to ship' })
      .expect(201);

    const notes = await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.id}/notes`)
      .set('Authorization', `Bearer ${supportToken}`)
      .expect(200);
    expect(notes.body).toHaveLength(2);
    expect(notes.body[0].note).toBe('Customer called about delivery');
    expect(notes.body[1].note).toBe('Stock checked, ready to ship');

    await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.id}/notes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Customer-facing responses never include notes (internal thread or the
    // legacy scalar order notes field).
    const ownDetail = await request(app.getHttpServer())
      .get(`/api/v1/orders/mine/${order.id}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(ownDetail.body).not.toHaveProperty('notes');
    expect(ownDetail.body).not.toHaveProperty('internalNotes');
    expect(ownDetail.body).not.toHaveProperty('orderNotes');

    const ownList = await request(app.getHttpServer())
      .get('/api/v1/orders/mine')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(ownList.body.data[0]).not.toHaveProperty('notes');
    expect(ownList.body.data[0]).not.toHaveProperty('internalNotes');

    // Customers cannot read or write the internal thread.
    await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.id}/notes`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/notes`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ note: 'customer note' })
      .expect(403);

    // Validation: blank and oversized notes are 400; unknown order is 404.
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/notes`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ note: '   ' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/notes`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ note: 'n'.repeat(2001) })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/orders/00000000-0000-4000-8000-000000000000/notes')
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ note: 'ghost' })
      .expect(404);
  });

  it('lets SUPPORT cancel PENDING orders only, restoring stock exactly once', async () => {
    const order = await createCustomerOrder(2);
    expect(await stockOf()).toBe(8);

    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${supportToken}`)
      .expect(201);
    expect(cancelled.body).toMatchObject({
      id: order.id,
      status: OrderStatus.CANCELLED,
    });
    expect(cancelled.body.cancelledAt).toEqual(expect.any(String));

    expect(await stockOf()).toBe(10);
    const returns = await prisma.stockMovement.findMany({
      where: { orderId: order.id, type: StockMovementType.RETURN },
    });
    expect(returns).toHaveLength(1);
    expect(returns[0]).toMatchObject({ quantityChange: 2, quantityAfter: 10 });
    expect(
      await prisma.auditLog.count({
        where: {
          action: 'order.cancelled',
          entityId: order.id,
          userId: supportId,
        },
      }),
    ).toBe(1);

    // Double cancel: 409, no second restore.
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${supportToken}`)
      .expect(409);
    expect(await stockOf()).toBe(10);
    expect(
      await prisma.stockMovement.count({
        where: { orderId: order.id, type: StockMovementType.RETURN },
      }),
    ).toBe(1);

    // A CONFIRMED order cannot be cancelled through the SUPPORT route.
    const confirmed = await createCustomerOrder(2);
    expect(await stockOf()).toBe(8);
    await prisma.order.update({
      where: { id: confirmed.id },
      data: { status: OrderStatus.CONFIRMED },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${confirmed.id}/cancel`)
      .set('Authorization', `Bearer ${supportToken}`)
      .expect(409);
    expect(await stockOf()).toBe(8);
    expect(
      await prisma.stockMovement.count({
        where: { orderId: confirmed.id, type: StockMovementType.RETURN },
      }),
    ).toBe(0);

    await request(app.getHttpServer())
      .post('/api/v1/orders/00000000-0000-4000-8000-000000000000/cancel')
      .set('Authorization', `Bearer ${supportToken}`)
      .expect(404);
  });

  it('forbids SUPPORT from stock, users, audit, reports, POs, costPrice and status changes', async () => {
    const order = await createCustomerOrder();

    // No stock adjustment or movement access.
    await request(app.getHttpServer())
      .post('/api/v1/stock/adjustments')
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ productId, quantityChange: 5, reason: 'support tweak' })
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/stock/movements')
      .set('Authorization', `Bearer ${supportToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/stock/low-stock')
      .set('Authorization', `Bearer ${supportToken}`)
      .expect(403);

    // No cost price leakage on product reads.
    const products = await request(app.getHttpServer())
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${supportToken}`)
      .expect(200);
    expect(products.body.data[0]).not.toHaveProperty('costPrice');
    const product = await request(app.getHttpServer())
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${supportToken}`)
      .expect(200);
    expect(product.body).not.toHaveProperty('costPrice');

    // No user management.
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${supportToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${supportToken}`)
      .send({
        name: 'New User',
        email: 'new-user@example.com',
        password: 'Password123!',
        role: 'STAFF',
      })
      .expect(403);

    // No audit log, dashboard or reports.
    await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${supportToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${supportToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/reports/inventory.csv')
      .set('Authorization', `Bearer ${supportToken}`)
      .expect(403);
    // No bulk personal-data export exists for SUPPORT (nor for anyone but
    // ADMIN); the sales report is ADMIN-only as well.
    await request(app.getHttpServer())
      .get('/api/v1/reports/sales.csv')
      .set('Authorization', `Bearer ${supportToken}`)
      .expect(403);

    // No purchase order receiving.
    await request(app.getHttpServer())
      .post(
        '/api/v1/purchase-orders/00000000-0000-4000-8000-000000000000/receive',
      )
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ items: [{ productId, quantity: 1 }] })
      .expect(403);

    // No status changes: confirming/cancelling via the STAFF route is 403;
    // only the dedicated PENDING cancel permission is granted.
    await request(app.getHttpServer())
      .patch(`/api/v1/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ newStatus: OrderStatus.CONFIRMED })
      .expect(403);

    expect(
      await prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
    ).toMatchObject({ status: OrderStatus.PENDING });
    expect(await stockOf()).toBe(8);

    // SUPPORT cancellation still works and did not require the status route.
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${supportToken}`)
      .expect(201);
    expect(await stockOf()).toBe(10);
    expect(customerId).toBeTruthy();
    expect(categoryId).toBeTruthy();
  });
});
