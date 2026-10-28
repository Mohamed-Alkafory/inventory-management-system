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

describe('Product image upload (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let uploadsDir: string;
  let adminToken: string;
  let staffToken: string;
  let productId: string;

  beforeAll(async () => {
    uploadsDir = await mkdtemp(join(tmpdir(), 'inventory-e2e-uploads-'));
    process.env.UPLOADS_DIR = uploadsDir;

    // Import after UPLOADS_DIR is set so ConfigModule validates the test value.
    const { AppModule } = await import('../src/app.module.js');
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const expressApp = moduleFixture.createNestApplication<NestExpressApplication>();
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
    // Mirrors main.ts: images are public and outside the API prefix.
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
    await prisma.user.create({
      data: {
        name: 'Staff',
        email: 'staff@example.com',
        passwordHash,
        role: UserRole.STAFF,
      },
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'Password123!' })
      .expect(200);
    adminToken = adminLogin.body.accessToken;

    const staffLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'staff@example.com', password: 'Password123!' })
      .expect(200);
    staffToken = staffLogin.body.accessToken;

    const category = await prisma.category.create({
      data: { name: 'Test category' },
    });
    const product = await prisma.product.create({
      data: {
        name: 'Upload product',
        sku: 'IMG-001',
        price: 10,
        categoryId: category.id,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    await disconnectDb();
    await app.close();
    await rm(uploadsDir, { recursive: true, force: true });
  });

  it('requires an authenticated ADMIN', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/image`)
      .attach('image', PNG, { filename: 'test.png', contentType: 'image/png' })
      .expect(401);

    await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/image`)
      .set('Authorization', `Bearer ${staffToken}`)
      .attach('image', PNG, { filename: 'test.png', contentType: 'image/png' })
      .expect(403);
  });

  it('uploads, serves publicly and deletes the image', async () => {
    const upload = await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/image`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', PNG, { filename: 'test.png', contentType: 'image/png' })
      .expect(200);

    expect(upload.body.imageUrl).toMatch(
      /^\/uploads\/products\/[0-9a-f-]+\.png$/,
    );

    // No Authorization header: uploaded images are public.
    await request(app.getHttpServer())
      .get(upload.body.imageUrl)
      .expect(200)
      .expect('Content-Type', /image\/png/);

    await request(app.getHttpServer())
      .delete(`/api/v1/products/${productId}/image`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(upload.body.imageUrl)
      .expect(404);
  });
});
