import 'dotenv/config';
import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PrismaService } from '../src/prisma/prisma.service.js';
import { PrismaExceptionFilter } from '../src/common/prisma-exception.filter.js';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter.js';
import { resetDb, disconnectDb } from './db-utils.js';
import {
  NotificationType,
  OrderStatus,
  PurchaseOrderStatus,
  UserRole,
} from '../src/generated/prisma/client.js';

/**
 * Consolidated role → route permission matrix.
 *
 * Every HTTP handler registered by the application must appear exactly once in
 * `buildMatrix()`, with an explicit allow/deny decision for unauthenticated
 * callers, CUSTOMER, SUPPORT, STAFF and ADMIN. The discovery test fails when a
 * new controller or handler is added without a matrix entry, so permissions
 * can never be decided implicitly by omission.
 *
 * The table runs against the real PostgreSQL test database (like
 * `inventory.e2e-spec.ts`) and is followed by focused security scenarios that
 * need more than a status-code assertion: cross-customer ownership, public
 * registration, SUPPORT limits, catalog privacy, order-note exclusion, detail
 * view auditing and last-active-ADMIN protection.
 */

const PASSWORD = 'Password123!';
const NEW_PASSWORD = 'NewPassword123!';

// 1x1 transparent PNG used for the two multipart routes.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

type Actor = 'anonymous' | 'customer' | 'support' | 'staff' | 'admin';
type Outcome = 'allow' | 'deny';
type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';

const ACTORS: readonly Actor[] = [
  'anonymous',
  'customer',
  'support',
  'staff',
  'admin',
];

const ALLOWED_STATUSES = new Set([200, 201, 204]);

interface MatrixEntry {
  method: Method;
  /** Route template as declared by Nest (`:id` placeholders included). */
  path: string;
  expected: Record<Actor, Outcome>;
  body?: (actor: Actor) => Record<string, unknown>;
  multipart?: boolean;
  params?: (actor: Actor) => Record<string, string>;
}

interface FixtureContext {
  tokens: Record<Actor, string>;
  refreshTokens: Record<Actor, string>;
  users: {
    admin: string;
    admin2: string;
    staff: string;
    support: string;
    customerA: string;
    customerB: string;
    patchTarget: string;
    deleteTarget: string;
  };
  ids: {
    categoryMain: string;
    categoryDelete: string;
    categoryInactive: string;
    supplierMain: string;
    supplierDelete: string;
    productMain: string;
    productDelete: string;
    productImage: string;
    productPO: string;
    productAdjust: string;
    productInactive: string;
    productHiddenCategory: string;
    orderDetail: string;
    orderUpdate: string;
    orderNotes: string;
    orderConfirmed: string;
    ownOrderA: string;
    ownOrderB: string;
    ownOrderCancelA: string;
    adminOwnOrder: string;
    adminOwnOrderCancel: string;
    orderStatus: Record<'admin' | 'staff', string>;
    orderCancel: Record<'admin' | 'staff' | 'support', string>;
    poDraft: string;
    poStatus: string;
    poReceive: Record<'admin' | 'staff', string>;
    contactMessage: string;
    notification: Record<'admin' | 'staff' | 'support' | 'customerA' | 'customerB', string>;
  };
}

let app: INestApplication;
let prisma: PrismaService;
let uploadsDir: string;
let requestIpCounter = 0;

/** Every request gets its own client IP so the global/route throttles never interfere. */
function nextIp(): string {
  requestIpCounter += 1;
  return `10.${(requestIpCounter >> 16) & 255}.${(requestIpCounter >> 8) & 255}.${requestIpCounter & 255}`;
}

function sendRequest(method: Method, path: string) {
  const server = app.getHttpServer();

  switch (method) {
    case 'get':
      return request(server).get(path);
    case 'post':
      return request(server).post(path);
    case 'patch':
      return request(server).patch(path);
    case 'put':
      return request(server).put(path);
    case 'delete':
      return request(server).delete(path);
  }
}

function requestAs(
  context: FixtureContext,
  actor: Actor,
  method: Method,
  path: string,
) {
  const call = sendRequest(method, path).set('X-Forwarded-For', nextIp());
  if (actor !== 'anonymous') {
    call.set('Authorization', `Bearer ${context.tokens[actor]}`);
  }
  return call;
}

function allowFor(...allowed: Actor[]): Record<Actor, Outcome> {
  const result = {} as Record<Actor, Outcome>;
  for (const actor of ACTORS) {
    result[actor] = allowed.includes(actor) ? 'allow' : 'deny';
  }
  return result;
}

const AUTHENTICATED_ONLY = allowFor('customer', 'support', 'staff', 'admin');
const ADMIN_ONLY = allowFor('admin');
const STAFF_OR_ADMIN = allowFor('staff', 'admin');
const SUPPORT_STAFF_ADMIN = allowFor('support', 'staff', 'admin');
const SUPPORT_ADMIN = allowFor('support', 'admin');
const READ_PRODUCTS = allowFor('support', 'staff', 'admin');
const READ_STOCK = allowFor('staff', 'admin');
const READ_SUPPLIERS = allowFor('staff', 'admin');
const READ_PURCHASE_ORDERS = allowFor('staff', 'admin');
/**
 * `/orders/mine*` is documented as the CUSTOMER surface, but `ROLE_PERMISSIONS`
 * makes ADMIN a superset of every role, so ADMIN also holds the `*_own`
 * permissions. The matrix records the permission model that actually ships;
 * STAFF and SUPPORT still lack these permissions.
 */
const OWN_ORDERS = allowFor('customer', 'admin');
const PUBLIC = allowFor(...ACTORS);

function pathWithParams(
  template: string,
  params: Record<string, string> | undefined,
): string {
  if (!params) return `/api/v1${template}`;

  return `/api/v1${template.replace(/:([A-Za-z0-9_]+)/g, (_match, name: string) => {
    const value = params[name];
    if (!value) {
      throw new Error(`Missing route parameter "${name}" for ${template}`);
    }
    return value;
  })}`;
}

function buildMatrix(context: FixtureContext): MatrixEntry[] {
  const { ids, users } = context;

  const adminOrderId = (actor: Actor) =>
    ids.orderStatus[actor === 'staff' ? 'staff' : 'admin'];
  const cancelOrderId = (actor: Actor) => {
    if (actor === 'staff' || actor === 'support' || actor === 'admin') {
      return ids.orderCancel[actor];
    }
    return ids.orderCancel.admin;
  };
  const notificationId = (actor: Actor) => {
    switch (actor) {
      case 'admin':
      case 'staff':
      case 'support':
        return ids.notification[actor];
      default:
        return ids.notification.customerA;
    }
  };

  return [
    // ------------------------------------------------------------------ public
    { method: 'get', path: '/health', expected: PUBLIC },
    {
      method: 'post',
      path: '/auth/login',
      expected: PUBLIC,
      body: () => ({ email: 'customer-a@example.com', password: PASSWORD }),
    },
    {
      method: 'post',
      path: '/auth/register',
      expected: PUBLIC,
      body: (actor) => ({
        name: `Matrix Register ${actor}`,
        email: `matrix-register-${actor}@example.com`,
        password: PASSWORD,
      }),
    },
    {
      method: 'post',
      path: '/auth/refresh',
      expected: PUBLIC,
      body: (actor) => ({ refreshToken: context.refreshTokens[actor] }),
    },
    {
      method: 'post',
      path: '/contact',
      expected: PUBLIC,
      body: () => ({
        name: 'Matrix Visitor',
        email: 'matrix-visitor@example.com',
        subject: 'Matrix contact',
        message: 'Matrix contact body',
      }),
    },
    { method: 'get', path: '/catalog/products', expected: PUBLIC },
    {
      method: 'get',
      path: '/catalog/products/:id',
      expected: PUBLIC,
      params: () => ({ id: ids.productMain }),
    },
    { method: 'get', path: '/catalog/categories', expected: PUBLIC },

    // ----------------------------------------------------------- own account
    { method: 'get', path: '/auth/me', expected: AUTHENTICATED_ONLY },
    {
      method: 'patch',
      path: '/auth/me',
      expected: AUTHENTICATED_ONLY,
      body: (actor) => ({ name: `Matrix ${actor}` }),
    },
    { method: 'get', path: '/auth/admin-only', expected: ADMIN_ONLY },
    {
      method: 'post',
      path: '/auth/logout',
      expected: AUTHENTICATED_ONLY,
      body: () => ({ refreshToken: 'matrix-unknown-refresh-token' }),
    },
    { method: 'post', path: '/users/me/avatar', expected: AUTHENTICATED_ONLY, multipart: true },
    { method: 'delete', path: '/users/me/avatar', expected: AUTHENTICATED_ONLY },

    // ------------------------------------------------------------- categories
    { method: 'get', path: '/categories', expected: READ_PRODUCTS },
    {
      method: 'get',
      path: '/categories/:id',
      expected: READ_PRODUCTS,
      params: () => ({ id: ids.categoryMain }),
    },
    {
      method: 'post',
      path: '/categories',
      expected: ADMIN_ONLY,
      body: () => ({ name: 'Matrix Created Category' }),
    },
    {
      method: 'patch',
      path: '/categories/:id',
      expected: ADMIN_ONLY,
      params: () => ({ id: ids.categoryMain }),
      body: () => ({ description: 'Matrix updated category' }),
    },
    {
      method: 'delete',
      path: '/categories/:id',
      expected: ADMIN_ONLY,
      params: () => ({ id: ids.categoryDelete }),
    },

    // --------------------------------------------------------------- products
    { method: 'get', path: '/products', expected: READ_PRODUCTS },
    {
      method: 'get',
      path: '/products/:id',
      expected: READ_PRODUCTS,
      params: () => ({ id: ids.productMain }),
    },
    {
      method: 'post',
      path: '/products',
      expected: ADMIN_ONLY,
      body: () => ({
        sku: 'MATRIX-NEW-001',
        name: 'Matrix Created Product',
        price: 10,
        categoryId: ids.categoryMain,
      }),
    },
    {
      method: 'patch',
      path: '/products/:id',
      expected: ADMIN_ONLY,
      params: () => ({ id: ids.productMain }),
      body: () => ({ name: 'Matrix Updated Product' }),
    },
    {
      method: 'post',
      path: '/products/:id/image',
      expected: ADMIN_ONLY,
      params: () => ({ id: ids.productImage }),
      multipart: true,
    },
    {
      method: 'delete',
      path: '/products/:id/image',
      expected: ADMIN_ONLY,
      params: () => ({ id: ids.productImage }),
    },
    {
      method: 'delete',
      path: '/products/:id',
      expected: ADMIN_ONLY,
      params: () => ({ id: ids.productDelete }),
    },
    {
      method: 'get',
      path: '/products/:id/movements',
      expected: READ_STOCK,
      params: () => ({ id: ids.productMain }),
    },

    // ------------------------------------------------------------------ stock
    { method: 'get', path: '/stock/movements', expected: READ_STOCK },
    {
      method: 'post',
      path: '/stock/adjustments',
      expected: READ_STOCK,
      body: () => ({
        productId: ids.productAdjust,
        quantityChange: 1,
        reason: 'Matrix adjustment',
      }),
    },
    { method: 'get', path: '/stock/low-stock', expected: READ_STOCK },

    // -------------------------------------------------------------- suppliers
    { method: 'get', path: '/suppliers', expected: READ_SUPPLIERS },
    {
      method: 'get',
      path: '/suppliers/:id',
      expected: READ_SUPPLIERS,
      params: () => ({ id: ids.supplierMain }),
    },
    {
      method: 'post',
      path: '/suppliers',
      expected: ADMIN_ONLY,
      body: () => ({ companyName: 'Matrix Created Supplier' }),
    },
    {
      method: 'patch',
      path: '/suppliers/:id',
      expected: ADMIN_ONLY,
      params: () => ({ id: ids.supplierMain }),
      body: () => ({ companyName: 'Matrix Updated Supplier' }),
    },
    {
      method: 'delete',
      path: '/suppliers/:id',
      expected: ADMIN_ONLY,
      params: () => ({ id: ids.supplierDelete }),
    },

    // ----------------------------------------------------------------- orders
    { method: 'get', path: '/orders', expected: SUPPORT_STAFF_ADMIN },
    {
      method: 'get',
      path: '/orders/:id',
      expected: SUPPORT_STAFF_ADMIN,
      params: () => ({ id: ids.orderDetail }),
    },
    {
      method: 'post',
      path: '/orders',
      expected: STAFF_OR_ADMIN,
      body: () => ({
        items: [{ productId: ids.productMain, quantity: 1 }],
        customerName: 'Matrix Walk-in',
      }),
    },
    {
      method: 'patch',
      path: '/orders/:id',
      expected: STAFF_OR_ADMIN,
      params: () => ({ id: ids.orderUpdate }),
      body: () => ({ customerName: 'Matrix Updated Order' }),
    },
    {
      method: 'patch',
      path: '/orders/:id/status',
      expected: STAFF_OR_ADMIN,
      params: (actor) => ({ id: adminOrderId(actor) }),
      body: () => ({ newStatus: 'CONFIRMED' }),
    },
    {
      method: 'post',
      path: '/orders/:id/cancel',
      expected: SUPPORT_STAFF_ADMIN,
      params: (actor) => ({ id: cancelOrderId(actor) }),
    },
    {
      method: 'post',
      path: '/orders/:id/notes',
      expected: SUPPORT_STAFF_ADMIN,
      params: () => ({ id: ids.orderNotes }),
      body: () => ({ note: 'Matrix internal note' }),
    },
    {
      method: 'get',
      path: '/orders/:id/notes',
      expected: SUPPORT_STAFF_ADMIN,
      params: () => ({ id: ids.orderNotes }),
    },
    {
      method: 'post',
      path: '/orders/mine',
      expected: OWN_ORDERS,
      body: () => ({
        items: [{ productId: ids.productMain, quantity: 1 }],
        recipientName: 'Matrix Customer',
        recipientPhone: '+201000000000',
        shippingAddress: '1 Matrix Street',
        shippingCity: 'Cairo',
      }),
    },
    { method: 'get', path: '/orders/mine', expected: OWN_ORDERS },
    {
      method: 'get',
      path: '/orders/mine/:id',
      expected: OWN_ORDERS,
      params: (actor) => ({
        id: actor === 'admin' ? ids.adminOwnOrder : ids.ownOrderA,
      }),
    },
    {
      method: 'post',
      path: '/orders/mine/:id/cancel',
      expected: OWN_ORDERS,
      params: (actor) => ({
        id: actor === 'admin' ? ids.adminOwnOrderCancel : ids.ownOrderCancelA,
      }),
    },

    // ---------------------------------------------------------- notifications
    { method: 'get', path: '/notifications', expected: AUTHENTICATED_ONLY },
    {
      method: 'get',
      path: '/notifications/unread-count',
      expected: AUTHENTICATED_ONLY,
    },
    {
      method: 'patch',
      path: '/notifications/read-all',
      expected: AUTHENTICATED_ONLY,
    },
    {
      method: 'patch',
      path: '/notifications/:id/read',
      expected: AUTHENTICATED_ONLY,
      params: (actor) => ({ id: notificationId(actor) }),
    },
    {
      method: 'get',
      path: '/notifications/preferences',
      expected: AUTHENTICATED_ONLY,
    },
    {
      method: 'put',
      path: '/notifications/preferences',
      expected: AUTHENTICATED_ONLY,
      body: () => ({ preferences: [{ type: 'SYSTEM', enabled: false }] }),
    },

    // ------------------------------------------------------- contact messages
    { method: 'get', path: '/contact-messages', expected: SUPPORT_ADMIN },
    {
      method: 'get',
      path: '/contact-messages/:id',
      expected: SUPPORT_ADMIN,
      params: () => ({ id: ids.contactMessage }),
    },
    {
      method: 'patch',
      path: '/contact-messages/:id',
      expected: SUPPORT_ADMIN,
      params: () => ({ id: ids.contactMessage }),
      body: () => ({ status: 'IN_PROGRESS' }),
    },

    // -------------------------------------------------------------- dashboard
    { method: 'get', path: '/dashboard/summary', expected: ADMIN_ONLY },
    { method: 'get', path: '/dashboard/low-stock', expected: ADMIN_ONLY },
    { method: 'get', path: '/dashboard/sales', expected: ADMIN_ONLY },
    { method: 'get', path: '/dashboard/top-products', expected: ADMIN_ONLY },
    {
      method: 'get',
      path: '/dashboard/stock-movements',
      expected: ADMIN_ONLY,
    },

    // ------------------------------------------------------------------ audit
    { method: 'get', path: '/audit-logs', expected: ADMIN_ONLY },

    // ---------------------------------------------------------------- reports
    { method: 'get', path: '/reports/inventory.csv', expected: ADMIN_ONLY },
    { method: 'get', path: '/reports/low-stock.csv', expected: ADMIN_ONLY },
    { method: 'get', path: '/reports/sales.csv', expected: ADMIN_ONLY },
    {
      method: 'get',
      path: '/reports/stock-movements.csv',
      expected: ADMIN_ONLY,
    },

    // -------------------------------------------------------- purchase orders
    {
      method: 'get',
      path: '/purchase-orders',
      expected: READ_PURCHASE_ORDERS,
    },
    {
      method: 'get',
      path: '/purchase-orders/:id',
      expected: READ_PURCHASE_ORDERS,
      params: () => ({ id: ids.poDraft }),
    },
    {
      method: 'post',
      path: '/purchase-orders',
      expected: ADMIN_ONLY,
      body: () => ({
        supplierId: ids.supplierMain,
        items: [
          {
            productId: ids.productPO,
            quantityOrdered: 2,
            unitCost: 1,
          },
        ],
      }),
    },
    {
      method: 'patch',
      path: '/purchase-orders/:id/status',
      expected: ADMIN_ONLY,
      params: () => ({ id: ids.poStatus }),
      body: () => ({ newStatus: 'ORDERED' }),
    },
    {
      method: 'post',
      path: '/purchase-orders/:id/receive',
      expected: STAFF_OR_ADMIN,
      params: (actor) => ({
        id: ids.poReceive[actor === 'staff' ? 'staff' : 'admin'],
      }),
      body: () => ({ items: [{ productId: ids.productPO, quantity: 1 }] }),
    },

    // ------------------------------------------------------------------ users
    { method: 'get', path: '/users', expected: ADMIN_ONLY },
    {
      method: 'get',
      path: '/users/:id',
      expected: ADMIN_ONLY,
      params: () => ({ id: users.patchTarget }),
    },
    {
      method: 'post',
      path: '/users',
      expected: ADMIN_ONLY,
      body: () => ({
        name: 'Matrix Created User',
        email: 'matrix-created-user@example.com',
        password: PASSWORD,
        role: 'CUSTOMER',
      }),
    },
    {
      method: 'patch',
      path: '/users/:id',
      expected: ADMIN_ONLY,
      params: () => ({ id: users.patchTarget }),
      body: () => ({ name: 'Matrix Patched User' }),
    },
    {
      method: 'delete',
      path: '/users/:id',
      expected: ADMIN_ONLY,
      params: () => ({ id: users.deleteTarget }),
    },

    // ------------------------------------------------------ destructive last
    {
      method: 'post',
      path: '/auth/change-password',
      expected: AUTHENTICATED_ONLY,
      body: () => ({
        currentPassword: PASSWORD,
        newPassword: NEW_PASSWORD,
      }),
    },
    { method: 'delete', path: '/auth/me', expected: AUTHENTICATED_ONLY },
  ];
}

function toPaths(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  return [String(value ?? '')];
}

function normalizePath(...parts: string[]): string {
  const segments = parts
    .join('/')
    .split('/')
    .filter((segment) => segment.length > 0);
  return `/${segments.join('/')}`;
}

/** Discover every registered controller handler (method + normalized path). */
function discoverRoutes(application: INestApplication): string[] {
  const discovery = application.get(DiscoveryService);
  const routes: string[] = [];

  for (const wrapper of discovery.getControllers()) {
    const controller = wrapper.metatype;
    if (!controller) continue;

    const controllerPaths = toPaths(
      Reflect.getMetadata(PATH_METADATA, controller),
    );
    const prototype = Object.getPrototypeOf(
      wrapper.instance ?? controller.prototype,
    ) as object;

    for (const name of Object.getOwnPropertyNames(prototype)) {
      if (name === 'constructor') continue;

      const handler = (prototype as Record<string, unknown>)[name];
      if (typeof handler !== 'function') continue;

      const handlerPath = Reflect.getMetadata(PATH_METADATA, handler);
      if (handlerPath === undefined) continue;

      const methodNumber = Reflect.getMetadata(
        METHOD_METADATA,
        handler,
      ) as RequestMethod;
      const method = RequestMethod[methodNumber]?.toLowerCase();
      if (!method) continue;

      for (const controllerPath of controllerPaths) {
        for (const routePath of toPaths(handlerPath)) {
          routes.push(
            `${method} ${normalizePath(controllerPath, routePath)}`,
          );
        }
      }
    }
  }

  return routes;
}

async function login(
  email: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await sendRequest('post', '/api/v1/auth/login')
    .set('X-Forwarded-For', nextIp())
    .send({ email, password: PASSWORD })
    .expect(200);

  return {
    accessToken: response.body.accessToken as string,
    refreshToken: response.body.refreshToken as string,
  };
}

async function seedFixtures(): Promise<FixtureContext> {
  const passwordHash = await bcrypt.hash(PASSWORD, 4);

  const createUser = (name: string, email: string, role: UserRole) =>
    prisma.user.create({ data: { name, email, passwordHash, role } });

  const admin = await createUser('Admin', 'admin@example.com', UserRole.ADMIN);
  const admin2 = await createUser(
    'Second Admin',
    'admin2@example.com',
    UserRole.ADMIN,
  );
  const staff = await createUser('Staff', 'staff@example.com', UserRole.STAFF);
  const support = await createUser(
    'Support',
    'support@example.com',
    UserRole.SUPPORT,
  );
  const customerA = await createUser(
    'Customer A',
    'customer-a@example.com',
    UserRole.CUSTOMER,
  );
  const customerB = await createUser(
    'Customer B',
    'customer-b@example.com',
    UserRole.CUSTOMER,
  );
  const patchTarget = await createUser(
    'Patch Target',
    'patch-target@example.com',
    UserRole.CUSTOMER,
  );
  const deleteTarget = await createUser(
    'Delete Target',
    'delete-target@example.com',
    UserRole.CUSTOMER,
  );

  const categoryMain = await prisma.category.create({
    data: { name: 'Matrix Main Category' },
  });
  const categoryDelete = await prisma.category.create({
    data: { name: 'Matrix Deletable Category' },
  });
  const categoryInactive = await prisma.category.create({
    data: { name: 'Matrix Inactive Category', isActive: false },
  });

  const supplierMain = await prisma.supplier.create({
    data: { companyName: 'Matrix Main Supplier' },
  });
  const supplierDelete = await prisma.supplier.create({
    data: { companyName: 'Matrix Deletable Supplier' },
  });

  const productMain = await prisma.product.create({
    data: {
      sku: 'MATRIX-MAIN-001',
      name: 'Matrix Main Product',
      price: 10,
      costPrice: 5,
      quantity: 1000,
      minStock: 5,
      barcode: 'MATRIX-BARCODE-001',
      categoryId: categoryMain.id,
      supplierId: supplierMain.id,
    },
  });
  const productDelete = await prisma.product.create({
    data: {
      sku: 'MATRIX-DELETE-001',
      name: 'Matrix Deletable Product',
      price: 10,
      quantity: 5,
      categoryId: categoryMain.id,
    },
  });
  const productImage = await prisma.product.create({
    data: {
      sku: 'MATRIX-IMAGE-001',
      name: 'Matrix Image Product',
      price: 10,
      quantity: 5,
      categoryId: categoryMain.id,
    },
  });
  const productPO = await prisma.product.create({
    data: {
      sku: 'MATRIX-PO-001',
      name: 'Matrix Purchase Product',
      price: 10,
      quantity: 5,
      categoryId: categoryMain.id,
      supplierId: supplierMain.id,
    },
  });
  const productAdjust = await prisma.product.create({
    data: {
      sku: 'MATRIX-ADJUST-001',
      name: 'Matrix Adjustable Product',
      price: 10,
      quantity: 10,
      categoryId: categoryMain.id,
    },
  });
  const productInactive = await prisma.product.create({
    data: {
      sku: 'MATRIX-INACTIVE-001',
      name: 'Matrix Inactive Product',
      price: 10,
      quantity: 10,
      isActive: false,
      categoryId: categoryMain.id,
    },
  });
  const productHiddenCategory = await prisma.product.create({
    data: {
      sku: 'MATRIX-HIDDEN-001',
      name: 'Matrix Hidden Category Product',
      price: 10,
      quantity: 10,
      categoryId: categoryInactive.id,
    },
  });

  let orderCounter = 0;
  const createOrder = async (
    status: OrderStatus,
    createdById: string,
    customerId?: string,
  ) => {
    orderCounter += 1;
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-MX-${String(orderCounter).padStart(4, '0')}`,
        status,
        totalAmount: 10,
        createdById,
        customerId: customerId ?? null,
        customerName: customerId ? null : 'Matrix Walk-in',
        recipientName: customerId ? 'Matrix Customer' : null,
        recipientPhone: customerId ? '+201000000000' : null,
        shippingAddress: customerId ? '1 Matrix Street' : null,
        shippingCity: customerId ? 'Cairo' : null,
      },
    });
    return order.id;
  };

  const orderDetail = await createOrder(OrderStatus.PENDING, admin.id);
  const orderUpdate = await createOrder(OrderStatus.PENDING, admin.id);
  const orderNotes = await createOrder(OrderStatus.PENDING, admin.id);
  const orderConfirmed = await createOrder(OrderStatus.CONFIRMED, admin.id);
  const ownOrderA = await createOrder(
    OrderStatus.PENDING,
    customerA.id,
    customerA.id,
  );
  const ownOrderB = await createOrder(
    OrderStatus.PENDING,
    customerB.id,
    customerB.id,
  );
  const ownOrderCancelA = await createOrder(
    OrderStatus.PENDING,
    customerA.id,
    customerA.id,
  );
  // ADMIN is a permission superset and also holds the `*_own` permissions.
  const adminOwnOrder = await createOrder(
    OrderStatus.PENDING,
    admin.id,
    admin.id,
  );
  const adminOwnOrderCancel = await createOrder(
    OrderStatus.PENDING,
    admin.id,
    admin.id,
  );

  const orderStatus = {
    admin: await createOrder(OrderStatus.PENDING, admin.id),
    staff: await createOrder(OrderStatus.PENDING, staff.id),
  };
  const orderCancel = {
    admin: await createOrder(OrderStatus.PENDING, admin.id),
    staff: await createOrder(OrderStatus.PENDING, staff.id),
    support: await createOrder(OrderStatus.PENDING, support.id),
  };

  let poCounter = 0;
  const createPo = async (
    status: PurchaseOrderStatus,
    createdById: string,
  ) => {
    poCounter += 1;
    const po = await prisma.purchaseOrder.create({
      data: {
        orderNumber: `PO-MX-${String(poCounter).padStart(4, '0')}`,
        supplierId: supplierMain.id,
        status,
        totalAmount: 3,
        createdById,
        items: {
          create: [
            {
              productId: productPO.id,
              quantityOrdered: 3,
              unitCost: 1,
            },
          ],
        },
      },
    });
    return po.id;
  };

  const poDraft = await createPo(PurchaseOrderStatus.DRAFT, admin.id);
  const poStatus = await createPo(PurchaseOrderStatus.DRAFT, admin.id);
  const poReceive = {
    admin: await createPo(PurchaseOrderStatus.ORDERED, admin.id),
    staff: await createPo(PurchaseOrderStatus.ORDERED, staff.id),
  };

  const contactMessage = await prisma.contactMessage.create({
    data: {
      name: 'Matrix Visitor',
      email: 'visitor@example.com',
      subject: 'Matrix subject',
      message: 'Matrix message',
    },
  });

  const createNotification = (userId: string, title: string) =>
    prisma.notification.create({
      data: {
        userId,
        type: NotificationType.SYSTEM,
        title,
        message: `${title} body`,
      },
    });

  const notification = {
    admin: (await createNotification(admin.id, 'Admin matrix')).id,
    staff: (await createNotification(staff.id, 'Staff matrix')).id,
    support: (await createNotification(support.id, 'Support matrix')).id,
    customerA: (await createNotification(customerA.id, 'Customer A matrix')).id,
    customerB: (await createNotification(customerB.id, 'Customer B matrix')).id,
  };

  const adminSession = await login('admin@example.com');
  const staffSession = await login('staff@example.com');
  const supportSession = await login('support@example.com');
  const customerASession = await login('customer-a@example.com');
  const customerBSession = await login('customer-b@example.com');

  return {
    tokens: {
      anonymous: '',
      customer: customerASession.accessToken,
      support: supportSession.accessToken,
      staff: staffSession.accessToken,
      admin: adminSession.accessToken,
    },
    refreshTokens: {
      anonymous: customerBSession.refreshToken,
      customer: customerASession.refreshToken,
      support: supportSession.refreshToken,
      staff: staffSession.refreshToken,
      admin: adminSession.refreshToken,
    },
    users: {
      admin: admin.id,
      admin2: admin2.id,
      staff: staff.id,
      support: support.id,
      customerA: customerA.id,
      customerB: customerB.id,
      patchTarget: patchTarget.id,
      deleteTarget: deleteTarget.id,
    },
    ids: {
      categoryMain: categoryMain.id,
      categoryDelete: categoryDelete.id,
      categoryInactive: categoryInactive.id,
      supplierMain: supplierMain.id,
      supplierDelete: supplierDelete.id,
      productMain: productMain.id,
      productDelete: productDelete.id,
      productImage: productImage.id,
      productPO: productPO.id,
      productAdjust: productAdjust.id,
      productInactive: productInactive.id,
      productHiddenCategory: productHiddenCategory.id,
      orderDetail,
      orderUpdate,
      orderNotes,
      orderConfirmed,
      ownOrderA,
      ownOrderB,
      ownOrderCancelA,
      adminOwnOrder,
      adminOwnOrderCancel,
      orderStatus,
      orderCancel,
      poDraft,
      poStatus,
      poReceive,
      contactMessage: contactMessage.id,
      notification,
    },
  };
}

describe('Role permission matrix (e2e)', () => {
  beforeAll(async () => {
    uploadsDir = await mkdtemp(join(tmpdir(), 'inventory-matrix-uploads-'));
    process.env.UPLOADS_DIR = uploadsDir;

    // Import after UPLOADS_DIR is set so ConfigModule validates the test value.
    const { AppModule } = await import('../src/app.module.js');
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule, DiscoveryModule],
    }).compile();

    const expressApp =
      moduleFixture.createNestApplication<NestExpressApplication>();
    expressApp.setGlobalPrefix('api/v1');
    expressApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    expressApp.useGlobalFilters(
      new PrismaExceptionFilter(),
      new AllExceptionsFilter(),
    );
    // Trust X-Forwarded-For so each matrix request has its own throttle bucket.
    expressApp.getHttpAdapter().getInstance().set('trust proxy', true);
    await expressApp.init();

    app = expressApp;
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await disconnectDb();
    await app.close();
    await rm(uploadsDir, { recursive: true, force: true });
  });

  describe('route coverage', () => {
    let context: FixtureContext;

    beforeAll(async () => {
      await resetDb();
      context = await seedFixtures();
    });

    it('covers every registered route exactly once', () => {
      const discovered = discoverRoutes(app);
      const matrix = buildMatrix(context);
      const matrixKeys = matrix.map(
        (entry) => `${entry.method} ${entry.path}`,
      );

      expect(new Set(discovered).size).toBe(discovered.length);
      expect(new Set(matrixKeys).size).toBe(matrixKeys.length);

      const missing = discovered.filter((route) => !matrixKeys.includes(route));
      expect(missing, `Routes missing from the matrix: ${missing.join(', ')}`).toEqual([]);

      const extra = matrixKeys.filter((route) => !discovered.includes(route));
      expect(extra, `Matrix entries with no registered route: ${extra.join(', ')}`).toEqual([]);

      expect(discovered.length).toBe(78);
    });
  });

  describe('route permission matrix', () => {
    let context: FixtureContext;
    let matrix: MatrixEntry[] = [];

    beforeAll(async () => {
      await resetDb();
      context = await seedFixtures();
      matrix = buildMatrix(context);
    });

    it('declares every expected outcome for all five callers', () => {
      for (const entry of matrix) {
        for (const actor of ACTORS) {
          expect(
            entry.expected[actor],
            `${entry.method} ${entry.path} has no expectation for ${actor}`,
          ).toMatch(/^(allow|deny)$/);
        }
      }
    });

    for (const entry of buildMatrix({} as FixtureContext)) {
      describe(`${entry.method.toUpperCase()} ${entry.path}`, () => {
        for (const actor of ACTORS) {
          it(`${actor} → ${entry.expected[actor]}`, async () => {
            // The loop above only supplies stable test names; the seeded
            // fixture context is attached by the time the test runs.
            const matrixEntry = matrix.find(
              (candidate) =>
                candidate.method === entry.method &&
                candidate.path === entry.path,
            );
            if (!matrixEntry) {
              throw new Error(
                `Missing matrix entry for ${entry.method} ${entry.path}`,
              );
            }

            const url = pathWithParams(
              matrixEntry.path,
              matrixEntry.params?.(actor),
            );
            const call = requestAs(context, actor, matrixEntry.method, url);

            if (matrixEntry.multipart) {
              call.attach('image', PNG, {
                filename: 'matrix.png',
                contentType: 'image/png',
              });
            } else if (matrixEntry.body) {
              call.send(matrixEntry.body(actor));
            }

            const response = await call;
            const diagnostic = `${matrixEntry.method.toUpperCase()} ${matrixEntry.path} as ${actor} returned ${response.status}: ${JSON.stringify(response.body)}`;

            if (matrixEntry.expected[actor] === 'allow') {
              expect(
                ALLOWED_STATUSES.has(response.status),
                diagnostic,
              ).toBe(true);
            } else {
              const expectedStatus = actor === 'anonymous' ? 401 : 403;
              expect(response.status, diagnostic).toBe(expectedStatus);
            }
          });
        }
      });
    }
  });

  describe('cross-customer isolation', () => {
    let context: FixtureContext;

    beforeEach(async () => {
      await resetDb();
      context = await seedFixtures();
    });

    it("returns 404 (not 403) when reading another customer's order", async () => {
      await requestAs(
        context,
        'customer',
        'get',
        `/api/v1/orders/mine/${context.ids.ownOrderB}`,
      ).expect(404);
    });

    it("returns 404 when cancelling another customer's order", async () => {
      await requestAs(
        context,
        'customer',
        'post',
        `/api/v1/orders/mine/${context.ids.ownOrderB}/cancel`,
      ).expect(404);

      const stillPending = await prisma.order.findUnique({
        where: { id: context.ids.ownOrderB },
      });
      expect(stillPending?.status).toBe(OrderStatus.PENDING);
    });

    it('lists only the caller’s own orders', async () => {
      const response = await requestAs(
        context,
        'customer',
        'get',
        '/api/v1/orders/mine',
      ).expect(200);

      const ids = (response.body.data as Array<{ id: string }>).map(
        (order) => order.id,
      );
      expect(ids).toEqual(
        expect.arrayContaining([context.ids.ownOrderA, context.ids.ownOrderCancelA]),
      );
      expect(ids).not.toContain(context.ids.ownOrderB);
    });

    it('never exposes another customer’s notifications and 404s on their id', async () => {
      const list = await requestAs(
        context,
        'customer',
        'get',
        '/api/v1/notifications',
      ).expect(200);
      const ids = (list.body.data as Array<{ id: string }>).map(
        (notification) => notification.id,
      );
      expect(ids).toContain(context.ids.notification.customerA);
      expect(ids).not.toContain(context.ids.notification.customerB);

      await requestAs(
        context,
        'customer',
        'patch',
        `/api/v1/notifications/${context.ids.notification.customerB}/read`,
      ).expect(404);
    });

    it('returns only the caller’s profile and forbids another customer’s user row', async () => {
      const me = await requestAs(
        context,
        'customer',
        'get',
        '/api/v1/auth/me',
      ).expect(200);
      expect(me.body.id).toBe(context.users.customerA);

      await requestAs(
        context,
        'customer',
        'get',
        `/api/v1/users/${context.users.customerB}`,
      ).expect(403);
    });
  });

  describe('CUSTOMER restricted surfaces', () => {
    let context: FixtureContext;

    beforeEach(async () => {
      await resetDb();
      context = await seedFixtures();
    });

    it.each([
      ['get', '/api/v1/stock/movements'],
      ['post', '/api/v1/stock/adjustments'],
      ['get', '/api/v1/suppliers'],
      ['get', '/api/v1/purchase-orders'],
      ['get', '/api/v1/users'],
      ['get', '/api/v1/audit-logs'],
      ['get', '/api/v1/dashboard/summary'],
      ['get', '/api/v1/reports/inventory.csv'],
      ['get', '/api/v1/orders'],
    ] as const)('%s %s is forbidden', async (method, path) => {
      await requestAs(context, 'customer', method, path).expect(403);
    });
  });

  describe('public registration', () => {
    let context: FixtureContext;

    beforeEach(async () => {
      await resetDb();
      context = await seedFixtures();
    });

    it('rejects a registration payload that tries to choose a role', async () => {
      await requestAs(context, 'anonymous', 'post', '/api/v1/auth/register')
        .send({
          name: 'Role Escalation',
          email: 'role-escalation@example.com',
          password: PASSWORD,
          role: 'ADMIN',
        })
        .expect(400);

      const created = await prisma.user.findUnique({
        where: { email: 'role-escalation@example.com' },
      });
      expect(created).toBeNull();
    });

    it('always creates a CUSTOMER account', async () => {
      const response = await requestAs(
        context,
        'anonymous',
        'post',
        '/api/v1/auth/register',
      )
        .send({
          name: 'Public Customer',
          email: 'public-customer@example.com',
          password: PASSWORD,
        })
        .expect(201);

      expect(response.body.user.role).toBe('CUSTOMER');
      expect(response.body.user).not.toHaveProperty('passwordHash');

      const created = await prisma.user.findUnique({
        where: { email: 'public-customer@example.com' },
      });
      expect(created?.role).toBe(UserRole.CUSTOMER);
    });
  });

  describe('SUPPORT limits', () => {
    let context: FixtureContext;

    beforeEach(async () => {
      await resetDb();
      context = await seedFixtures();
    });

    it('cannot adjust stock, manage users, read audit logs or confirm orders', async () => {
      await requestAs(context, 'support', 'post', '/api/v1/stock/adjustments')
        .send({
          productId: context.ids.productAdjust,
          quantityChange: 1,
          reason: 'SUPPORT must be refused',
        })
        .expect(403);
      await requestAs(context, 'support', 'get', '/api/v1/users').expect(403);
      await requestAs(context, 'support', 'get', '/api/v1/audit-logs').expect(403);
      await requestAs(
        context,
        'support',
        'patch',
        `/api/v1/orders/${context.ids.orderDetail}/status`,
      )
        .send({ newStatus: 'CONFIRMED' })
        .expect(403);
    });

    it('never receives costPrice from product endpoints', async () => {
      const detail = await requestAs(
        context,
        'support',
        'get',
        `/api/v1/products/${context.ids.productMain}`,
      ).expect(200);
      expect(detail.body).not.toHaveProperty('costPrice');
      expect(JSON.stringify(detail.body)).not.toContain('costPrice');

      const list = await requestAs(
        context,
        'support',
        'get',
        '/api/v1/products',
      ).expect(200);
      expect(JSON.stringify(list.body)).not.toContain('costPrice');
    });

    it('can cancel PENDING orders but not CONFIRMED ones', async () => {
      await requestAs(
        context,
        'support',
        'post',
        `/api/v1/orders/${context.ids.orderCancel.support}/cancel`,
      ).expect(201);

      await requestAs(
        context,
        'support',
        'post',
        `/api/v1/orders/${context.ids.orderConfirmed}/cancel`,
      ).expect(409);
    });

    it('can read the contact inbox and triage messages', async () => {
      await requestAs(
        context,
        'support',
        'get',
        '/api/v1/contact-messages',
      ).expect(200);
      await requestAs(
        context,
        'support',
        'patch',
        `/api/v1/contact-messages/${context.ids.contactMessage}`,
      )
        .send({ status: 'IN_PROGRESS' })
        .expect(200);
    });
  });

  describe('public catalog privacy', () => {
    let context: FixtureContext;

    beforeEach(async () => {
      await resetDb();
      context = await seedFixtures();
    });

    const PUBLIC_PRODUCT_KEYS = new Set([
      'category',
      'description',
      'id',
      'imageUrl',
      'inStock',
      'maxOrderable',
      'name',
      'price',
      'sku',
    ]);

    it('hides inactive products and inactive categories', async () => {
      const list = await requestAs(
        context,
        'anonymous',
        'get',
        '/api/v1/catalog/products?limit=50',
      ).expect(200);

      const ids = (list.body.data as Array<{ id: string }>).map(
        (product) => product.id,
      );
      expect(ids).toContain(context.ids.productMain);
      expect(ids).not.toContain(context.ids.productInactive);
      expect(ids).not.toContain(context.ids.productHiddenCategory);

      await requestAs(
        context,
        'anonymous',
        'get',
        `/api/v1/catalog/products/${context.ids.productInactive}`,
      ).expect(404);
      await requestAs(
        context,
        'anonymous',
        'get',
        `/api/v1/catalog/products/${context.ids.productHiddenCategory}`,
      ).expect(404);
    });

    it('never leaks internal product fields', async () => {
      const list = await requestAs(
        context,
        'anonymous',
        'get',
        '/api/v1/catalog/products?limit=50',
      ).expect(200);

      for (const product of list.body.data as Array<Record<string, unknown>>) {
        for (const key of Object.keys(product)) {
          expect(PUBLIC_PRODUCT_KEYS.has(key), `Unexpected catalog key ${key}`).toBe(true);
        }
      }

      const text = JSON.stringify(list.body);
      for (const forbidden of [
        'costPrice',
        'minStock',
        'quantity',
        'barcode',
        'supplierId',
        'supplier',
      ]) {
        expect(text).not.toContain(forbidden);
      }

      const detail = await requestAs(
        context,
        'anonymous',
        'get',
        `/api/v1/catalog/products/${context.ids.productMain}`,
      ).expect(200);
      expect(detail.body).not.toHaveProperty('quantity');
      expect(detail.body).not.toHaveProperty('costPrice');
      expect(detail.body).not.toHaveProperty('barcode');
    });
  });

  describe('order note exclusion', () => {
    let context: FixtureContext;
    const SECRET_NOTE = 'SECRET-INTERNAL-NOTE-DO-NOT-LEAK';

    beforeEach(async () => {
      await resetDb();
      context = await seedFixtures();
      await prisma.orderNote.create({
        data: {
          orderId: context.ids.ownOrderA,
          authorId: context.users.support,
          note: SECRET_NOTE,
        },
      });
    });

    it('never returns internal notes in the customer order detail', async () => {
      const response = await requestAs(
        context,
        'customer',
        'get',
        `/api/v1/orders/mine/${context.ids.ownOrderA}`,
      ).expect(200);

      expect(JSON.stringify(response.body)).not.toContain(SECRET_NOTE);
      expect(response.body).not.toHaveProperty('notes');
      expect(response.body).not.toHaveProperty('internalNotes');
    });

    it('never returns internal notes in the customer order list', async () => {
      const response = await requestAs(
        context,
        'customer',
        'get',
        '/api/v1/orders/mine',
      ).expect(200);

      expect(JSON.stringify(response.body)).not.toContain(SECRET_NOTE);
    });
  });

  describe('order detail audit trail', () => {
    let context: FixtureContext;

    beforeEach(async () => {
      await resetDb();
      context = await seedFixtures();
    });

    it('writes an order.viewed entry for SUPPORT and STAFF, but not ADMIN', async () => {
      await requestAs(
        context,
        'support',
        'get',
        `/api/v1/orders/${context.ids.orderDetail}`,
      ).expect(200);
      await requestAs(
        context,
        'staff',
        'get',
        `/api/v1/orders/${context.ids.orderDetail}`,
      ).expect(200);

      const audits = await prisma.auditLog.findMany({
        where: {
          action: 'order.viewed',
          entityId: context.ids.orderDetail,
        },
      });
      expect(audits).toHaveLength(2);
      expect(audits.map((entry) => entry.userId)).toEqual(
        expect.arrayContaining([context.users.support, context.users.staff]),
      );

      await requestAs(
        context,
        'admin',
        'get',
        `/api/v1/orders/${context.ids.orderDetail}`,
      ).expect(200);

      const afterAdmin = await prisma.auditLog.count({
        where: {
          action: 'order.viewed',
          entityId: context.ids.orderDetail,
        },
      });
      expect(afterAdmin).toBe(2);
    });
  });

  describe('last active ADMIN protection', () => {
    let context: FixtureContext;

    beforeEach(async () => {
      await resetDb();
      context = await seedFixtures();
      // Leave exactly one active ADMIN for this group.
      await prisma.user.delete({ where: { id: context.users.admin2 } });
    });

    it('refuses to demote the last active ADMIN', async () => {
      await requestAs(
        context,
        'admin',
        'patch',
        `/api/v1/users/${context.users.admin}`,
      )
        .send({ role: 'STAFF' })
        .expect(409);
    });

    it('refuses to deactivate the last active ADMIN', async () => {
      await requestAs(
        context,
        'admin',
        'delete',
        `/api/v1/users/${context.users.admin}`,
      ).expect(409);

      await requestAs(
        context,
        'admin',
        'delete',
        '/api/v1/auth/me',
      ).expect(409);

      const admin = await prisma.user.findUnique({
        where: { id: context.users.admin },
      });
      expect(admin?.isActive).toBe(true);
      expect(admin?.role).toBe(UserRole.ADMIN);
    });
  });
});
