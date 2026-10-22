import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PrismaExceptionFilter } from '../src/common/prisma-exception.filter.js';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter.js';

/**
 * E2E coverage for issue #6 acceptance criteria: seeded admin/staff can log
 * in, unauthenticated requests get 401, wrong role gets 403, refresh rotation
 * and logout work, and `GET /products` stays available to authenticated users.
 *
 * The database layer is replaced with an in-memory fake (same pattern as
 * app.e2e-spec.ts) so the suite runs without a live Postgres; password checks
 * still go through real bcrypt against the seed credentials.
 */

type FakeRow = Record<string, unknown>;

interface FakeDb {
  users: FakeRow[];
  refreshTokens: FakeRow[];
}

function project(row: FakeRow, select?: Record<string, boolean>): FakeRow {
  if (!row) return null as unknown as FakeRow;
  if (!select) return { ...row };
  const out: FakeRow = {};
  for (const [key, keep] of Object.entries(select)) {
    if (keep) out[key] = row[key];
  }
  return out;
}

function matchesWhere(row: FakeRow, where: FakeRow = {}): boolean {
  if (typeof where['email'] === 'string' && row['email'] !== where['email']) {
    return false;
  }
  if (typeof where['id'] === 'string' && row['id'] !== where['id']) {
    return false;
  }
  const idFilter = where['id'] as { not?: string } | string | undefined;
  if (idFilter && typeof idFilter === 'object' && idFilter.not && row['id'] === idFilter.not) {
    return false;
  }
  if (typeof where['role'] === 'string' && row['role'] !== where['role']) {
    return false;
  }
  if (typeof where['isActive'] === 'boolean' && row['isActive'] !== where['isActive']) {
    return false;
  }
  const or = where['OR'] as FakeRow[] | undefined;
  if (or && !or.some((clause) => matchesWhere(row, clause))) {
    return false;
  }
  return true;
}

function createFakePrisma(db: FakeDb) {
  return {
    async onModuleInit() {},
    async onModuleDestroy() {},
    async $queryRaw() {
      return [{ 1: 1 }];
    },
    user: {
      async findUnique(args: {
        where: FakeRow;
        select?: Record<string, boolean>;
      }) {
        const row = db.users.find((u) => matchesWhere(u, args.where));
        return row ? project(row, args.select) : null;
      },
      async findMany(args: {
        where?: FakeRow;
        skip?: number;
        take?: number;
        orderBy?: Record<string, 'asc' | 'desc'>;
        select?: Record<string, boolean>;
      }) {
        let rows = db.users.filter((u) => matchesWhere(u, args.where ?? {}));
        const orderBy = args.orderBy ?? {};
        const [key, dir] = Object.entries(orderBy)[0] ?? ['createdAt', 'desc'];
        rows = [...rows].sort((a, b) => {
          const av = a[key] instanceof Date ? (a[key] as Date).getTime() : String(a[key]);
          const bv = b[key] instanceof Date ? (b[key] as Date).getTime() : String(b[key]);
          const cmp = av < bv ? -1 : av > bv ? 1 : 0;
          return dir === 'desc' ? -cmp : cmp;
        });
        const skip = args.skip ?? 0;
        const take = args.take ?? rows.length;
        return rows.slice(skip, skip + take).map((r) => project(r, args.select));
      },
      async count(args: { where?: FakeRow }) {
        return db.users.filter((u) => matchesWhere(u, args.where ?? {})).length;
      },
      async create(args: {
        data: FakeRow;
        select?: Record<string, boolean>;
      }) {
        const now = new Date();
        const row: FakeRow = {
          id: randomUUID(),
          isActive: true,
          createdAt: now,
          updatedAt: now,
          ...args.data,
        };
        db.users.push(row);
        return project(row, args.select);
      },
      async update(args: {
        where: { id: string };
        data: FakeRow;
        select?: Record<string, boolean>;
      }) {
        const row = db.users.find((u) => u['id'] === args.where.id);
        if (!row) throw new Error('Record to update not found.');
        Object.assign(row, args.data, { updatedAt: new Date() });
        return project(row, args.select);
      },
    },
    refreshToken: {
      async create(args: { data: FakeRow }) {
        const row: FakeRow = {
          id: randomUUID(),
          revokedAt: null,
          createdAt: new Date(),
          ...args.data,
        };
        db.refreshTokens.push(row);
        return { ...row };
      },
      async findUnique(args: {
        where: { tokenHash: string };
        include?: { user?: boolean };
      }) {
        const row = db.refreshTokens.find(
          (t) => t['tokenHash'] === args.where.tokenHash,
        );
        if (!row) return null;
        if (args.include?.user) {
          const user = db.users.find((u) => u['id'] === row['userId']);
          return { ...row, user: user ? { ...user } : null };
        }
        return { ...row };
      },
      async update(args: { where: { id: string }; data: FakeRow }) {
        const row = db.refreshTokens.find((t) => t['id'] === args.where.id);
        if (!row) throw new Error('Record to update not found.');
        Object.assign(row, args.data);
        return { ...row };
      },
    },
    product: {
      async findMany() {
        return [];
      },
    },
  };
}

describe('Auth & Users (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let staffToken: string;

  const db: FakeDb = { users: [], refreshTokens: [] };

  const seedUsers = async () => {
    db.users = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Admin User',
        email: 'admin@example.com',
        passwordHash: await bcrypt.hash('Admin123!', 4),
        role: 'ADMIN',
        isActive: true,
        createdAt: new Date('2026-10-15T00:00:00Z'),
        updatedAt: new Date('2026-10-15T00:00:00Z'),
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Staff User',
        email: 'staff@example.com',
        passwordHash: await bcrypt.hash('Staff123!', 4),
        role: 'STAFF',
        isActive: true,
        createdAt: new Date('2026-10-15T00:00:00Z'),
        updatedAt: new Date('2026-10-15T00:00:00Z'),
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Inactive User',
        email: 'inactive@example.com',
        passwordHash: await bcrypt.hash('Inactive123!', 4),
        role: 'STAFF',
        isActive: false,
        createdAt: new Date('2026-10-15T00:00:00Z'),
        updatedAt: new Date('2026-10-15T00:00:00Z'),
      },
    ];
    db.refreshTokens = [];
  };

  const loginAs = async (email: string, password: string) => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body as {
      accessToken: string;
      refreshToken: string;
      user: { email: string; role: string };
    };
  };

  beforeAll(async () => {
    await seedUsers();

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createFakePrisma(db))
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    // Mirror main.ts global pipeline so e2e sees production behaviour.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new PrismaExceptionFilter(), new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Fresh state per test: users may have been created/renamed/deactivated.
    await seedUsers();
    if (!adminToken) {
      adminToken = (await loginAs('admin@example.com', 'Admin123!')).accessToken;
      staffToken = (await loginAs('staff@example.com', 'Staff123!')).accessToken;
    }
  });

  describe('POST /auth/login', () => {
    it('logs the seeded admin in and never exposes hashes', async () => {
      const body = await loginAs('admin@example.com', 'Admin123!');

      expect(body.user).toEqual({
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'ADMIN',
      });
      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.refreshToken).toEqual(expect.any(String));
      expect(JSON.stringify(body)).not.toContain('passwordHash');
      expect(JSON.stringify(body)).not.toContain('$2');
    });

    it('logs the seeded staff in', async () => {
      const body = await loginAs('staff@example.com', 'Staff123!');
      expect(body.user.role).toBe('STAFF');
    });

    it('rejects a wrong password with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@example.com', password: 'Wrong123!' })
        .expect(401);
    });

    it('rejects an inactive user with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'inactive@example.com', password: 'Inactive123!' })
        .expect(401);
    });

    it('rejects a malformed body with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email' })
        .expect(400);
    });
  });

  describe('refresh & logout', () => {
    it('rotates a valid refresh token and rejects the old one', async () => {
      const first = await loginAs('admin@example.com', 'Admin123!');

      const refreshed = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(200);

      expect(refreshed.body.accessToken).toEqual(expect.any(String));
      expect(refreshed.body.refreshToken).not.toBe(first.refreshToken);

      // The presented token was revoked by rotation → replay is a 401.
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(401);

      // The rotated token still works.
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: refreshed.body.refreshToken })
        .expect(200);
    });

    it('rejects an unknown refresh token with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'never-issued-token-value-1234567890' })
        .expect(401);
    });

    it('logout returns 204 and kills the refresh token', async () => {
      const login = await loginAs('admin@example.com', 'Admin123!');

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${login.accessToken}`)
        .send({ refreshToken: login.refreshToken })
        .expect(204);

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: login.refreshToken })
        .expect(401);
    });

    it('logout requires authentication (401)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken: 'never-issued-token-value-1234567890' })
        .expect(401);
    });
  });

  describe('authorization rules', () => {
    it('GET /products is 401 without a token and 200 with one', async () => {
      await request(app.getHttpServer()).get('/api/v1/products').expect(401);

      await request(app.getHttpServer())
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('GET /users is 401 unauthenticated, 403 for STAFF, 200 for ADMIN', async () => {
      await request(app.getHttpServer()).get('/api/v1/users').expect(401);

      await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);

      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(3);
      expect(res.body.meta).toEqual({
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1,
      });
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('GET /auth/admin-only is 403 for STAFF and 200 for ADMIN', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/admin-only')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .get('/api/v1/auth/admin-only')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('UsersModule', () => {
    it('creates a user (201) without exposing the password hash', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Created User',
          email: 'created@example.com',
          password: 'Created123!',
          role: 'STAFF',
        })
        .expect(201);

      expect(res.body.email).toBe('created@example.com');
      expect(res.body).not.toHaveProperty('passwordHash');
      expect(JSON.stringify(res.body)).not.toContain('$2');

      // The stored hash is a real bcrypt hash and the account can log in.
      const stored = db.users.find((u) => u['email'] === 'created@example.com');
      expect(String(stored?.passwordHash)).toMatch(/^\$2/);
      await loginAs('created@example.com', 'Created123!');
    });

    it('rejects a duplicate email with 409', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Dup',
          email: 'admin@example.com',
          password: 'Whatever123!',
          role: 'STAFF',
        })
        .expect(409);
    });

    it('forbids STAFF from creating users (403)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          name: 'Nope',
          email: 'nope@example.com',
          password: 'Whatever123!',
          role: 'STAFF',
        })
        .expect(403);
    });

    it('gets one user by id and 404s for unknown ids', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/22222222-2222-4222-8222-222222222222')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.email).toBe('staff@example.com');
      expect(res.body).not.toHaveProperty('passwordHash');

      await request(app.getHttpServer())
        .get('/api/v1/users/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('updates a user and deactivates them (soft delete, 204)', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/users/22222222-2222-4222-8222-222222222222')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Renamed Staff' })
        .expect(200)
        .then((res) => {
          expect(res.body.name).toBe('Renamed Staff');
          expect(res.body).not.toHaveProperty('passwordHash');
        });

      await request(app.getHttpServer())
        .delete('/api/v1/users/22222222-2222-4222-8222-222222222222')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      const staff = db.users.find(
        (u) => u['id'] === '22222222-2222-4222-8222-222222222222',
      );
      expect(staff?.isActive).toBe(false);
      // Soft delete: the row survives (AD-001).
      expect(staff).toBeDefined();
    });

    it('rejects self-deactivation with 422', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/users/11111111-1111-4111-8111-111111111111')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(422);
    });
  });

  describe('GET /health', () => {
    it('stays public', async () => {
      await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    });
  });
});
