import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PrismaExceptionFilter } from '../src/common/prisma-exception.filter.js';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { UserRole } from '../src/generated/prisma/client.js';
import { resetDb, disconnectDb } from './db-utils.js';

// 1x1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

describe('User avatar upload (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let uploadsDir: string;
  let staffToken: string;
  let staffId: string;

  beforeAll(async () => {
    uploadsDir = await mkdtemp(join(tmpdir(), 'inventory-e2e-avatars-'));
    process.env.UPLOADS_DIR = uploadsDir;

    // Import after UPLOADS_DIR is set so ConfigModule validates the test value.
    const { AppModule } = await import('../src/app.module.js');
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
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
      new AllExceptionsFilter(),
      new PrismaExceptionFilter(),
    );
    // Mirrors main.ts: uploads are public and outside the API prefix.
    expressApp.useStaticAssets(uploadsDir, { prefix: '/uploads/' });
    await expressApp.init();
    app = expressApp;

    prisma = app.get(PrismaService);
    await resetDb();

    const passwordHash = await bcrypt.hash('Password123!', 4);
    await prisma.user.create({
      data: {
        name: 'Admin',
        email: 'admin@example.com',
        passwordHash,
        role: UserRole.ADMIN,
      },
    });
    const staff = await prisma.user.create({
      data: {
        name: 'Staff',
        email: 'staff@example.com',
        passwordHash,
        role: UserRole.STAFF,
      },
    });
    staffId = staff.id;

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'staff@example.com', password: 'Password123!' })
      .expect(200);
    staffToken = login.body.accessToken;
  });

  afterAll(async () => {
    await disconnectDb();
    await app.close();
    await rm(uploadsDir, { recursive: true, force: true });
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/users/me/avatar')
      .attach('image', PNG, { filename: 'test.png', contentType: 'image/png' })
      .expect(401);

    await request(app.getHttpServer())
      .delete('/api/v1/users/me/avatar')
      .expect(401);
  });

  it('uploads, serves publicly and deletes the current user avatar', async () => {
    const upload = await request(app.getHttpServer())
      .post('/api/v1/users/me/avatar')
      .set('Authorization', `Bearer ${staffToken}`)
      .attach('image', PNG, { filename: 'test.png', contentType: 'image/png' })
      .expect(200);

    expect(upload.body).toMatchObject({ id: staffId, name: 'Staff' });
    expect(upload.body.avatarUrl).toMatch(
      /^\/uploads\/avatars\/[0-9a-f-]+\.png$/,
    );
    expect(upload.body).not.toHaveProperty('passwordHash');

    // No Authorization header: uploaded avatars are public.
    await request(app.getHttpServer())
      .get(upload.body.avatarUrl)
      .expect(200)
      .expect('Content-Type', /image\/png/);

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(me.body.avatarUrl).toBe(upload.body.avatarUrl);
    expect(me.body).not.toHaveProperty('passwordHash');

    await request(app.getHttpServer())
      .delete('/api/v1/users/me/avatar')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(upload.body.avatarUrl)
      .expect(404);

    const after = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(after.body.avatarUrl).toBeNull();
  });

  it('rejects a non-image file and a file over 1 MB', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/users/me/avatar')
      .set('Authorization', `Bearer ${staffToken}`)
      .attach('image', Buffer.from('not an image'), {
        filename: 'fake.png',
        contentType: 'image/png',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/users/me/avatar')
      .set('Authorization', `Bearer ${staffToken}`)
      .attach('image', Buffer.alloc(1024 * 1024 + 1), {
        filename: 'big.png',
        contentType: 'image/png',
      })
      .expect(413);
  });
});
