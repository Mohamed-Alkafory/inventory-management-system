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

function createFakePrisma() {
  const users = [
    { id: ADMIN_ID, role: 'ADMIN', isActive: true },
    { id: STAFF_ID, role: 'STAFF', isActive: true },
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
  };
}

describe('Authorization (e2e)', () => {
  let app: INestApplication;
  let staffToken: string;

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
});
