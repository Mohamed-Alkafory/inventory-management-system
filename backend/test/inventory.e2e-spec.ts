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
  UserRole,
  OrderStatus,
  PurchaseOrderStatus,
  StockMovementType,
  NotificationType,
} from '../src/generated/prisma/client.js';

describe('Inventory Scenarios (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let staffToken: string;
  let _adminId: string;
  let _staffId: string;

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

    // Seed basic data
    const passwordHash = await bcrypt.hash('Password123!', 4);
    const admin = await prisma.user.create({
      data: {
        name: 'Admin',
        email: 'admin@example.com',
        passwordHash,
        role: UserRole.ADMIN,
      },
    });
    _adminId = admin.id;

    const staff = await prisma.user.create({
      data: {
        name: 'Staff',
        email: 'staff@example.com',
        passwordHash,
        role: UserRole.STAFF,
      },
    });
    _staffId = staff.id;

    // Login to get tokens
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'Password123!' });
    adminToken = adminLogin.body.accessToken;

    const staffLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'staff@example.com', password: 'Password123!' });
    staffToken = staffLogin.body.accessToken;
  });

  describe('Login flow and role checks', () => {
    it('returns 401 without a token', async () => {
      await request(app.getHttpServer()).get('/api/v1/users').expect(401);
    });

    it('returns 403 for STAFF on admin endpoints', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });

    it('returns 200 for ADMIN on admin endpoints', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Permission map — STAFF operational access', () => {
    it('allows STAFF to adjust stock (201)', async () => {
      const category = await prisma.category.create({
        data: { name: 'Permission Supplies' },
      });
      const product = await prisma.product.create({
        data: {
          name: 'Adjustable Item',
          sku: 'ADJ-001',
          price: 10,
          quantity: 5,
          categoryId: category.id,
        },
      });

      await request(app.getHttpServer())
        .post('/api/v1/stock/adjustments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          productId: product.id,
          quantityChange: 3,
          reason: 'Permission map check',
        })
        .expect(201);

      const updated = await prisma.product.findUnique({
        where: { id: product.id },
      });
      expect(updated?.quantity).toBe(8);
    });

    it('allows STAFF to change order status (200)', async () => {
      const category = await prisma.category.create({
        data: { name: 'Permission Orders' },
      });
      const product = await prisma.product.create({
        data: {
          name: 'Order Item',
          sku: 'ORD-ADJ-001',
          price: 12,
          quantity: 4,
          categoryId: category.id,
        },
      });

      const order = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customerName: 'Permission Customer',
          items: [{ productId: product.id, quantity: 1 }],
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${order.body.id}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ newStatus: OrderStatus.CONFIRMED })
        .expect(200);
    });
  });

  describe('Order stock scenarios', () => {
    let categoryId: string;
    let productId: string;

    beforeEach(async () => {
      const category = await prisma.category.create({
        data: { name: 'Electronics' },
      });
      categoryId = category.id;

      const product = await prisma.product.create({
        data: {
          name: 'Laptop',
          sku: 'LAP-001',
          price: 1000,
          quantity: 5,
          minStock: 2,
          categoryId,
        },
      });
      productId = product.id;
    });

    it('rejects an order that exceeds the stock (409) and no data is changed', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customerName: 'John Doe',
          items: [{ productId, quantity: 10 }],
        })
        .expect(409);

      const p = await prisma.product.findUnique({ where: { id: productId } });
      expect(p?.quantity).toBe(5);

      const ordersCount = await prisma.order.count();
      expect(ordersCount).toBe(0);
    });

    it('handles two simultaneous orders for the last item: exactly one succeeds', async () => {
      // Set stock to 1
      await prisma.product.update({
        where: { id: productId },
        data: { quantity: 1 },
      });

      const orderPayload = {
        customerName: 'Concurrent Client',
        items: [{ productId, quantity: 1 }],
      };

      // Fire two requests simultaneously
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/orders')
          .set('Authorization', `Bearer ${staffToken}`)
          .send(orderPayload),
        request(app.getHttpServer())
          .post('/api/v1/orders')
          .set('Authorization', `Bearer ${staffToken}`)
          .send(orderPayload),
      ]);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(201);
      expect(statuses).toContain(409);

      const p = await prisma.product.findUnique({ where: { id: productId } });
      expect(p?.quantity).toBe(0);

      const ordersCount = await prisma.order.count();
      expect(ordersCount).toBe(1);
    });

    it('restores stock when an order is cancelled', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customerName: 'Cancel Test',
          items: [{ productId, quantity: 2 }],
        })
        .expect(201);

      const orderId = res.body.id;
      let p = await prisma.product.findUnique({ where: { id: productId } });
      expect(p?.quantity).toBe(3);

      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ newStatus: OrderStatus.CANCELLED })
        .expect(200);

      p = await prisma.product.findUnique({ where: { id: productId } });
      expect(p?.quantity).toBe(5);

      const movements = await prisma.stockMovement.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
      });
      expect(movements).toHaveLength(2);
      expect(movements[0].type).toBe(StockMovementType.SALE);
      expect(movements[0].quantityChange).toBe(-2);
      expect(movements[1].type).toBe(StockMovementType.RETURN);
      expect(movements[1].quantityChange).toBe(2);
    });

    it('cancelling an order twice does not restore stock twice', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customerName: 'Double Cancel',
          items: [{ productId, quantity: 2 }],
        })
        .expect(201);

      const orderId = res.body.id;

      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ newStatus: OrderStatus.CANCELLED })
        .expect(200);

      // Second attempt should fail with 409 (conflict) or be a no-op if the service handles it
      // Based on STATUS_TRANSITIONS: CANCELLED -> [] means it should be rejected.
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ newStatus: OrderStatus.CANCELLED })
        .expect(409);

      const p = await prisma.product.findUnique({ where: { id: productId } });
      expect(p?.quantity).toBe(5);
    });

    it('lists orders, retrieves order detail, and edits metadata while PENDING', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customerName: 'Original Customer',
          customerPhone: '+1111111111',
          notes: 'Initial note',
          items: [{ productId, quantity: 1 }],
        })
        .expect(201);

      const orderId = createRes.body.id;

      // GET /orders (list)
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
      expect(listRes.body.meta).toBeDefined();

      // GET /orders/:id (detail)
      const detailRes = await request(app.getHttpServer())
        .get(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(detailRes.body.id).toBe(orderId);
      expect(detailRes.body.items).toHaveLength(1);
      expect(detailRes.body.createdBy).toBeDefined();
      expect(detailRes.body.stockMovements.length).toBeGreaterThanOrEqual(1);

      // PATCH /orders/:id while PENDING (200)
      const patchRes = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customerName: 'Updated Customer',
          customerPhone: '+2222222222',
          notes: 'Updated note',
        })
        .expect(200);

      expect(patchRes.body.customerName).toBe('Updated Customer');
      expect(patchRes.body.customerPhone).toBe('+2222222222');
      expect(patchRes.body.notes).toBe('Updated note');

      // Transition to CONFIRMED
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ newStatus: OrderStatus.CONFIRMED })
        .expect(200);

      // PATCH /orders/:id when CONFIRMED should fail with 422
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customerName: 'Late edit attempt',
        })
        .expect(422);
    });
  });

  describe('Purchase Order scenarios', () => {
    let categoryId: string;
    let productId: string;
    let supplierId: string;

    beforeEach(async () => {
      const category = await prisma.category.create({
        data: { name: 'Supplies' },
      });
      categoryId = category.id;

      const supplier = await prisma.supplier.create({
        data: { companyName: 'Global Corp' },
      });
      supplierId = supplier.id;

      const product = await prisma.product.create({
        data: {
          name: 'Paper',
          sku: 'PAP-001',
          price: 10,
          quantity: 10,
          categoryId,
          supplierId,
        },
      });
      productId = product.id;
    });

    it('handles partial receive then full receive correctly', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierId,
          items: [{ productId, quantityOrdered: 100, unitCost: 5 }],
        })
        .expect(201);

      const poId = res.body.id;

      // Move to ORDERED status first (if needed by workflow)
      await request(app.getHttpServer())
        .patch(`/api/v1/purchase-orders/${poId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ newStatus: PurchaseOrderStatus.ORDERED })
        .expect(200);

      // Partial receive: 40
      await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${poId}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          items: [{ productId, quantity: 40 }],
        })
        .expect(200);

      let p = await prisma.product.findUnique({ where: { id: productId } });
      expect(p?.quantity).toBe(50); // 10 + 40

      let poi = await prisma.purchaseOrderItem.findUnique({
        where: {
          purchaseOrderId_productId: { purchaseOrderId: poId, productId },
        },
      });
      expect(poi?.quantityReceived).toBe(40);

      let po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
      expect(po?.status).toBe(PurchaseOrderStatus.PARTIALLY_RECEIVED);

      // Full receive: remaining 60
      await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${poId}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          items: [{ productId, quantity: 60 }],
        })
        .expect(200);

      p = await prisma.product.findUnique({ where: { id: productId } });
      expect(p?.quantity).toBe(110); // 50 + 60

      poi = await prisma.purchaseOrderItem.findUnique({
        where: {
          purchaseOrderId_productId: { purchaseOrderId: poId, productId },
        },
      });
      expect(poi?.quantityReceived).toBe(100);

      po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
      expect(po?.status).toBe(PurchaseOrderStatus.RECEIVED);
    });
  });

  describe('Product soft delete', () => {
    it('hides soft-deleted products from the default list', async () => {
      const category = await prisma.category.create({
        data: { name: 'Misc' },
      });
      await prisma.product.create({
        data: {
          name: 'Visible',
          sku: 'V-01',
          price: 10,
          categoryId: category.id,
          isActive: true,
        },
      });
      await prisma.product.create({
        data: {
          name: 'Hidden',
          sku: 'H-01',
          price: 10,
          categoryId: category.id,
          isActive: false,
        },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      const names = res.body.data.map((p: any) => p.name);
      expect(names).toContain('Visible');
      expect(names).not.toContain('Hidden');
    });
  });

  describe('Low-stock notification', () => {
    it('creates a notification once when stock drops below minStock', async () => {
      const category = await prisma.category.create({
        data: { name: 'Alerts' },
      });
      const product = await prisma.product.create({
        data: {
          name: 'Alert Product',
          sku: 'ALT-01',
          price: 10,
          quantity: 10,
          minStock: 5,
          categoryId: category.id,
        },
      });

      // Drop stock to 4 (below 5)
      await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          items: [{ productId: product.id, quantity: 6 }],
        })
        .expect(201);

      // Check notifications for admin
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const lowStockAlerts = res.body.data.filter(
        (n: any) =>
          n.type === NotificationType.LOW_STOCK && n.entityId === product.id,
      );
      expect(lowStockAlerts).toHaveLength(1);

      // Drop stock further to 3 (should not create another unread notification if dedupe works)
      await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          items: [{ productId: product.id, quantity: 1 }],
        })
        .expect(201);

      const res2 = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const lowStockAlerts2 = res2.body.data.filter(
        (n: any) =>
          n.type === NotificationType.LOW_STOCK && n.entityId === product.id,
      );
      expect(lowStockAlerts2).toHaveLength(1);
    });
  });
});
