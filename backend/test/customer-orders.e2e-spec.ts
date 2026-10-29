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
 * Customer-owned order scenarios against the real test database:
 * ownership scoping, server-side pricing, stock restore exactly once,
 * double cancel, concurrency and the staff/SUPPORT read boundary.
 */
describe('Customer-owned orders (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let customerAToken: string;
  let customerBToken: string;
  let supportToken: string;
  let customerAId: string;

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

    const customerA = await prisma.user.create({
      data: {
        name: 'Customer A',
        email: 'customer-a@example.com',
        passwordHash,
        role: UserRole.CUSTOMER,
      },
    });
    customerAId = customerA.id;

    await prisma.user.create({
      data: {
        name: 'Customer B',
        email: 'customer-b@example.com',
        passwordHash,
        role: UserRole.CUSTOMER,
      },
    });

    await prisma.user.create({
      data: {
        name: 'Staff',
        email: 'staff@example.com',
        passwordHash,
        role: UserRole.STAFF,
      },
    });

    await prisma.user.create({
      data: {
        name: 'Support',
        email: 'support@example.com',
        passwordHash,
        role: UserRole.SUPPORT,
      },
    });

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
      return res.body.accessToken as string;
    };

    customerAToken = await login('customer-a@example.com');
    customerBToken = await login('customer-b@example.com');
    supportToken = await login('support@example.com');

    const category = await prisma.category.create({
      data: { name: 'Customer Orders' },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: 'Customer Item',
        sku: 'CUST-001',
        price: 12.5,
        quantity: 100,
        categoryId,
      },
    });
    productId = product.id;
  });

  const ownOrderBody = (quantity = 2) => ({
    items: [{ productId, quantity }],
    recipientName: 'Alice Customer',
    recipientPhone: '+201005551234',
    shippingAddress: '12 Nile Street',
    shippingCity: 'Cairo',
    notes: 'Ring the bell',
  });

  const createOwnOrder = (token: string, quantity = 2) =>
    request(app.getHttpServer())
      .post('/api/v1/orders/mine')
      .set('Authorization', `Bearer ${token}`)
      .send(ownOrderBody(quantity));

  const stockOf = async (id: string) =>
    (
      await prisma.product.findUniqueOrThrow({
        where: { id },
      })
    ).quantity;

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

  it('creates an owned order with server-side totals, snapshots and stock', async () => {
    const res = await createOwnOrder(customerAToken).expect(201);

    expect(Object.keys(res.body).sort()).toEqual(CUSTOMER_KEYS);
    expect(res.body).toMatchObject({
      status: OrderStatus.PENDING,
      totalAmount: 25, // 2 × 12.50, never the client value
      paymentMethod: 'COD',
      recipientName: 'Alice Customer',
      recipientPhone: '+201005551234',
      shippingAddress: '12 Nile Street',
      shippingCity: 'Cairo',
      cancelledAt: null,
    });
    expect(res.body.items).toEqual([
      {
        productName: 'Customer Item',
        sku: 'CUST-001',
        quantity: 2,
        unitPrice: 12.5,
        lineTotal: 25,
      },
    ]);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: res.body.id },
      include: { orderItems: true, stockMovements: true },
    });
    expect(order.customerId).toBe(customerAId);
    expect(order.createdById).toBe(customerAId);
    // Staff screens keep working through the copied customer fields.
    expect(order.customerName).toBe('Alice Customer');
    expect(order.customerPhone).toBe('+201005551234');
    expect(order.paymentMethod).toBe('COD');

    expect(await stockOf(productId)).toBe(98);
    expect(order.stockMovements).toHaveLength(1);
    expect(order.stockMovements[0]).toMatchObject({
      type: StockMovementType.SALE,
      quantityChange: -2,
      quantityAfter: 98,
      orderId: order.id,
    });
  });

  it('lists only the caller’s orders, newest first, with an optional status filter', async () => {
    const first = await createOwnOrder(customerAToken, 1).expect(201);
    const second = await createOwnOrder(customerAToken, 2).expect(201);
    await createOwnOrder(customerBToken, 1).expect(201);

    const list = await request(app.getHttpServer())
      .get('/api/v1/orders/mine')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);

    expect(list.body.meta).toMatchObject({ page: 1, limit: 20, total: 2 });
    expect(list.body.data.map((o: { id: string }) => o.id)).toEqual([
      second.body.id,
      first.body.id,
    ]);
    for (const order of list.body.data) {
      expect(Object.keys(order).sort()).toEqual(CUSTOMER_KEYS);
      expect(order).not.toHaveProperty('createdById');
    }

    const pending = await request(app.getHttpServer())
      .get('/api/v1/orders/mine?status=PENDING')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);
    expect(pending.body.meta.total).toBe(2);

    const cancelled = await request(app.getHttpServer())
      .get('/api/v1/orders/mine?status=CANCELLED')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);
    expect(cancelled.body.meta.total).toBe(0);
  });

  it('never exposes another customer’s order (404, never 403) and never cancels it', async () => {
    const bOrder = await createOwnOrder(customerBToken, 2).expect(201);
    const stockBefore = await stockOf(productId);

    await request(app.getHttpServer())
      .get(`/api/v1/orders/mine/${bOrder.body.id}`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/orders/mine/${bOrder.body.id}/cancel`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get('/api/v1/orders/mine/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(404);

    expect(await stockOf(productId)).toBe(stockBefore);

    const bList = await request(app.getHttpServer())
      .get('/api/v1/orders/mine')
      .set('Authorization', `Bearer ${customerBToken}`)
      .expect(200);
    expect(bList.body.data).toHaveLength(1);
    expect(bList.body.data[0].status).toBe(OrderStatus.PENDING);
  });

  it('cancels an own PENDING order, restoring stock exactly once', async () => {
    const created = await createOwnOrder(customerAToken, 2).expect(201);
    expect(await stockOf(productId)).toBe(98);

    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/orders/mine/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(201);

    expect(cancelled.body).toMatchObject({
      id: created.body.id,
      status: OrderStatus.CANCELLED,
    });
    expect(cancelled.body.cancelledAt).toEqual(expect.any(String));
    expect(Object.keys(cancelled.body).sort()).toEqual(CUSTOMER_KEYS);

    expect(await stockOf(productId)).toBe(100);
    const returns = await prisma.stockMovement.findMany({
      where: {
        orderId: created.body.id,
        type: StockMovementType.RETURN,
      },
    });
    expect(returns).toHaveLength(1);
    expect(returns[0]).toMatchObject({ quantityChange: 2, quantityAfter: 100 });

    // Double cancel: 409 and no second restore.
    await request(app.getHttpServer())
      .post(`/api/v1/orders/mine/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(409);

    expect(await stockOf(productId)).toBe(100);
    const afterDouble = await prisma.stockMovement.count({
      where: {
        orderId: created.body.id,
        type: StockMovementType.RETURN,
      },
    });
    expect(afterDouble).toBe(1);
  });

  it('rejects cancelling a CONFIRMED order (409) without restoring stock', async () => {
    const created = await createOwnOrder(customerAToken, 2).expect(201);
    await prisma.order.update({
      where: { id: created.body.id },
      data: { status: OrderStatus.CONFIRMED },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/orders/mine/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(409);

    expect(await stockOf(productId)).toBe(98);
    const returns = await prisma.stockMovement.count({
      where: {
        orderId: created.body.id,
        type: StockMovementType.RETURN,
      },
    });
    expect(returns).toBe(0);
  });

  it('rejects inactive products with 422', async () => {
    await prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });

    await createOwnOrder(customerAToken, 1).expect(422);
    expect(await stockOf(productId)).toBe(100);
  });

  it('keeps stock safe for two concurrent orders of the last item', async () => {
    await prisma.product.update({
      where: { id: productId },
      data: { quantity: 1 },
    });

    const [first, second] = await Promise.all([
      createOwnOrder(customerAToken, 1),
      createOwnOrder(customerAToken, 1),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect(await stockOf(productId)).toBe(0);
    expect(
      await prisma.order.count({ where: { customerId: customerAId } }),
    ).toBe(1);
  });

  it('lets SUPPORT read every order but not confirm/cancel; CUSTOMER stays out of staff routes', async () => {
    const created = await prisma.order.create({
      data: {
        orderNumber: 'ORD-0001',
        status: OrderStatus.PENDING,
        customerName: 'Alice Customer',
        customerPhone: '+201005551234',
        totalAmount: 12.5,
        customerId: customerAId,
        recipientName: 'Alice Customer',
        recipientPhone: '+201005551234',
        shippingAddress: '12 Nile Street',
        shippingCity: 'Cairo',
        createdById: customerAId,
      },
    });

    const list = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${supportToken}`)
      .expect(200);
    expect(list.body.meta.total).toBe(1);
    expect(list.body.data[0].id).toBe(created.id);

    await request(app.getHttpServer())
      .get(`/api/v1/orders/${created.id}`)
      .set('Authorization', `Bearer ${supportToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/orders/${created.id}/status`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ newStatus: OrderStatus.CONFIRMED })
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ items: [{ productId, quantity: 1 }] })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/orders/${created.id}/status`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ newStatus: OrderStatus.CANCELLED })
      .expect(403);
  });
});
