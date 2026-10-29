import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService, Reflector } from '@nestjs/core';
import { PATH_METADATA } from '@nestjs/common/constants.js';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PrismaExceptionFilter } from '../src/common/prisma-exception.filter.js';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter.js';
import { IS_PUBLIC_KEY } from '../src/auth/decorators/public.decorator.js';
import { ANY_AUTHENTICATED_KEY } from '../src/auth/decorators/any-authenticated.decorator.js';
import { PERMISSIONS_KEY } from '../src/auth/decorators/require-permission.decorator.js';

/**
 * Authorization contract (issue: deny-by-default permissions).
 *
 * The database layer is mocked because authorization is decided from the user
 * row loaded by `JwtAuthGuard`; no business service is allowed to run for the
 * 401/403 assertions below. Successful STAFF calls are covered by the real
 * database scenarios in `inventory.e2e-spec.ts`.
 */

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const STAFF_ID = '22222222-2222-4222-8222-222222222222';
const SUPPORT_ID = '33333333-3333-4333-8333-333333333333';
const CUSTOMER_ID = '44444444-4444-4444-8444-444444444444';

function createFakePrisma() {
  const users = [
    { id: ADMIN_ID, role: 'ADMIN', isActive: true },
    { id: STAFF_ID, role: 'STAFF', isActive: true },
    { id: SUPPORT_ID, role: 'SUPPORT', isActive: true },
    { id: CUSTOMER_ID, role: 'CUSTOMER', isActive: true },
  ];

  return {
    async onModuleInit() {},
    async onModuleDestroy() {},
    async $queryRaw() {
      return [{ 1: 1 }];
    },
    user: {
      async findUnique(args: { where: { id?: string } }) {
        const row = users.find((user) => user.id === args.where.id);
        return row ? { ...row } : null;
      },
    },
    // Only reached by SUPPORT/CUSTOMER read routes that pass the guard;
    // writes and other modules are never expected to run in this suite.
    order: {
      async count() {
        return 0;
      },
      async findMany() {
        return [];
      },
      async findFirst() {
        return null;
      },
      async findUnique() {
        return null;
      },
    },
  };
}

describe('Authorization (e2e)', () => {
  let app: INestApplication;
  let staffToken: string;
  let supportToken: string;
  let customerToken: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule, DiscoveryModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createFakePrisma())
      .compile();

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

    const jwt = app.get(JwtService);
    staffToken = await jwt.signAsync({ sub: STAFF_ID, role: 'STAFF' });
    supportToken = await jwt.signAsync({ sub: SUPPORT_ID, role: 'SUPPORT' });
    customerToken = await jwt.signAsync({ sub: CUSTOMER_ID, role: 'CUSTOMER' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('route access metadata (fail closed)', () => {
    it('every route handler declares public, any-authenticated or a permission', () => {
      const reflector = app.get(Reflector);
      const missing: string[] = [];
      let handlers = 0;

      for (const wrapper of app.get(DiscoveryService).getControllers()) {
        const instance = wrapper.instance as object | undefined;
        if (!instance) continue;

        const prototype = Object.getPrototypeOf(instance) as object;
        const controller = prototype.constructor as new () => unknown;

        for (const name of Object.getOwnPropertyNames(prototype)) {
          if (name === 'constructor') continue;
          const handler = (prototype as Record<string, unknown>)[name];
          if (typeof handler !== 'function') continue;
          if (Reflect.getMetadata(PATH_METADATA, handler) === undefined) {
            continue;
          }

          handlers += 1;
          const targets = [handler, controller];
          const isPublic = reflector.getAllAndOverride<boolean>(
            IS_PUBLIC_KEY,
            targets,
          );
          const anyAuthenticated = reflector.getAllAndOverride<boolean>(
            ANY_AUTHENTICATED_KEY,
            targets,
          );
          const permissions = reflector.getAllAndOverride<string[]>(
            PERMISSIONS_KEY,
            targets,
          );

          if (!isPublic && !anyAuthenticated && !permissions?.length) {
            missing.push(`${wrapper.name}.${name}`);
          }
        }
      }

      expect(handlers).toBeGreaterThan(0);
      expect(missing).toEqual([]);
    });
  });

  describe('401 without a token', () => {
    const protectedRoutes: Array<[string, string]> = [
      ['get', '/api/v1/users'],
      ['get', '/api/v1/audit-logs'],
      ['get', '/api/v1/dashboard/summary'],
      ['get', '/api/v1/reports/inventory.csv'],
      ['post', '/api/v1/purchase-orders'],
      ['post', '/api/v1/stock/adjustments'],
      [
        'patch',
        '/api/v1/orders/22222222-2222-4222-8222-222222222222/status',
      ],
      [
        'post',
        '/api/v1/orders/22222222-2222-4222-8222-222222222222/cancel',
      ],
      [
        'post',
        '/api/v1/orders/22222222-2222-4222-8222-222222222222/notes',
      ],
      [
        'get',
        '/api/v1/orders/22222222-2222-4222-8222-222222222222/notes',
      ],
    ];

    it.each(protectedRoutes)(
      '%s %s is rejected before any role check',
      async (method, path) => {
        const call = request(app.getHttpServer())[
          method as 'get' | 'post' | 'patch'
        ](path);
        await call.expect(401);
      },
    );
  });

  describe('STAFF is forbidden on admin-only surfaces (403)', () => {
    it.each([
      ['get', '/api/v1/users'],
      ['get', '/api/v1/audit-logs'],
      ['get', '/api/v1/dashboard/summary'],
      ['get', '/api/v1/reports/inventory.csv'],
      ['post', '/api/v1/purchase-orders'],
    ] as const)('%s %s', async (method, path) => {
      const call = request(app.getHttpServer())[method](path).set(
        'Authorization',
        `Bearer ${staffToken}`,
      );
      await call.expect(403);
    });

    it('returns the standard FORBIDDEN error shape', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);

      expect(res.body).toMatchObject({
        statusCode: 403,
        error: 'FORBIDDEN',
        path: '/api/v1/users',
      });
      expect(res.body.message).toBe('Insufficient permissions');
      expect(res.body.timestamp).toEqual(expect.any(String));
    });
  });

  describe('CUSTOMER is forbidden on staff order surfaces (403)', () => {
    it.each([
      ['post', '/api/v1/orders'],
      ['get', '/api/v1/orders'],
      ['get', '/api/v1/orders/22222222-2222-4222-8222-222222222222'],
      ['patch', '/api/v1/orders/22222222-2222-4222-8222-222222222222'],
      [
        'patch',
        '/api/v1/orders/22222222-2222-4222-8222-222222222222/status',
      ],
    ] as const)('%s %s', async (method, path) => {
      await request(app.getHttpServer())
        [method](path)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('can list its own orders (guard passes; empty fixture)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/orders/mine')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body).toEqual({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });

    it('gets 404 (not 403) for an unknown own-order id', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/orders/mine/22222222-2222-4222-8222-222222222222')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(404);
    });
  });

  describe('SUPPORT can read every order and cancel PENDING ones only', () => {
    it('lists all orders (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${supportToken}`)
        .expect(200);

      expect(res.body.meta).toMatchObject({ page: 1, limit: 20, total: 0 });
    });

    it('gets 404 (not 403) for a missing order detail', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/orders/22222222-2222-4222-8222-222222222222')
        .set('Authorization', `Bearer ${supportToken}`)
        .expect(404);
    });

    it.each([
      [
        'patch',
        '/api/v1/orders/22222222-2222-4222-8222-222222222222/status',
      ],
      ['patch', '/api/v1/orders/22222222-2222-4222-8222-222222222222'],
      ['post', '/api/v1/orders'],
      ['post', '/api/v1/stock/adjustments'],
      ['get', '/api/v1/stock/movements'],
      ['get', '/api/v1/users'],
      ['post', '/api/v1/users'],
      ['get', '/api/v1/audit-logs'],
      ['get', '/api/v1/dashboard/summary'],
      ['get', '/api/v1/reports/inventory.csv'],
      ['get', '/api/v1/reports/sales.csv'],
      ['post', '/api/v1/purchase-orders'],
      [
        'post',
        '/api/v1/purchase-orders/22222222-2222-4222-8222-222222222222/receive',
      ],
    ] as const)('%s %s is forbidden', async (method, path) => {
      await request(app.getHttpServer())
        [method](path)
        .set('Authorization', `Bearer ${supportToken}`)
        .expect(403);
    });
  });
});
