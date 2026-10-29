import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PrismaExceptionFilter } from '../src/common/prisma-exception.filter.js';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter.js';
import { resetDb, disconnectDb } from './db-utils.js';

const PRODUCT_KEYS = [
  'category',
  'description',
  'id',
  'imageUrl',
  'inStock',
  'maxOrderable',
  'name',
  'price',
  'sku',
];

const CATEGORY_KEYS = ['description', 'id', 'name'];

/**
 * Public catalog against the real test database: no token is required, only
 * active rows appear, inactive/inactive-category products answer 404, and the
 * public response can never contain an internal product field.
 */
describe('Public catalog (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let activeCategoryId: string;
  let inactiveCategoryId: string;
  let activeProductId: string;
  let inactiveProductId: string;
  let hiddenByCategoryProductId: string;

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

    const activeCategory = await prisma.category.create({
      data: { name: 'Office', description: 'Office supplies' },
    });
    activeCategoryId = activeCategory.id;

    const inactiveCategory = await prisma.category.create({
      data: { name: 'Retired', isActive: false },
    });
    inactiveCategoryId = inactiveCategory.id;

    const newest = await prisma.product.create({
      data: {
        sku: 'OFF-NEW-001',
        name: 'Zebra Pen',
        description: 'Blue ink',
        price: 2.5,
        quantity: 25,
        minStock: 5,
        costPrice: 1,
        barcode: '1234567890123',
        categoryId: activeCategoryId,
        createdAt: new Date('2026-10-30T10:00:00Z'),
      },
    });
    activeProductId = newest.id;

    await prisma.product.create({
      data: {
        sku: 'OFF-OLD-002',
        name: 'Alpha Notebook',
        description: null,
        price: 10,
        quantity: 3,
        minStock: 1,
        costPrice: 4,
        categoryId: activeCategoryId,
        createdAt: new Date('2026-10-29T10:00:00Z'),
      },
    });

    // The SKU matches the search term but the name does not: public search is
    // name-only and must not reveal internal identifiers.
    await prisma.product.create({
      data: {
        sku: 'SEARCH-BY-SKU',
        name: 'Paper Clips',
        price: 3,
        quantity: 10,
        categoryId: activeCategoryId,
        createdAt: new Date('2026-10-28T10:00:00Z'),
      },
    });

    const inactive = await prisma.product.create({
      data: {
        sku: 'OFF-HIDDEN-003',
        name: 'Discontinued Stapler',
        price: 9,
        quantity: 10,
        categoryId: activeCategoryId,
        isActive: false,
      },
    });
    inactiveProductId = inactive.id;

    const hiddenByCategory = await prisma.product.create({
      data: {
        sku: 'RETIRED-004',
        name: 'Retired Binder',
        price: 7,
        quantity: 10,
        categoryId: inactiveCategoryId,
      },
    });
    hiddenByCategoryProductId = hiddenByCategory.id;
  });

  it('lists active products in active categories without a token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/catalog/products')
      .expect(200);

    expect(Object.keys(res.body).sort()).toEqual(['data', 'meta']);
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 20,
      total: 3,
      totalPages: 1,
    });

    const ids = res.body.data.map((p: { id: string }) => p.id);
    expect(ids).not.toContain(inactiveProductId);
    expect(ids).not.toContain(hiddenByCategoryProductId);

    for (const product of res.body.data) {
      expect(Object.keys(product).sort()).toEqual(PRODUCT_KEYS);
      expect(Object.keys(product.category).sort()).toEqual(['id', 'name']);
      expect(typeof product.price).toBe('number');
      expect(typeof product.inStock).toBe('boolean');
      for (const forbidden of [
        'costPrice',
        'minStock',
        'quantity',
        'barcode',
        'supplier',
        'supplierId',
        'categoryId',
        'isActive',
        'createdAt',
        'updatedAt',
      ]) {
        expect(product).not.toHaveProperty(forbidden);
      }
    }

    // `newest` (createdAt desc) is the default order.
    expect(res.body.data.map((p: { name: string }) => p.name)).toEqual([
      'Zebra Pen',
      'Alpha Notebook',
      'Paper Clips',
    ]);
  });

  it('returns the public product detail with inStock and capped maxOrderable', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/catalog/products/${activeProductId}`)
      .expect(200);

    expect(Object.keys(res.body).sort()).toEqual(PRODUCT_KEYS);
    expect(res.body).toMatchObject({
      id: activeProductId,
      sku: 'OFF-NEW-001',
      name: 'Zebra Pen',
      description: 'Blue ink',
      price: 2.5,
      imageUrl: null,
      category: { id: activeCategoryId, name: 'Office' },
      inStock: true,
      maxOrderable: 20,
    });
  });

  it('answers 404 for inactive products and products in inactive categories', async () => {
    for (const id of [
      inactiveProductId,
      hiddenByCategoryProductId,
      '00000000-0000-4000-8000-000000000000',
    ]) {
      await request(app.getHttpServer())
        .get(`/api/v1/catalog/products/${id}`)
        .expect(404);
    }
  });

  it('hides out-of-stock quantity behind inStock/maxOrderable only', async () => {
    const product = await prisma.product.create({
      data: {
        sku: 'OUT-005',
        name: 'Empty Marker',
        price: 1,
        quantity: 0,
        categoryId: activeCategoryId,
      },
    });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/catalog/products/${product.id}`)
      .expect(200);

    expect(res.body).toMatchObject({ inStock: false, maxOrderable: 0 });
    expect(res.body).not.toHaveProperty('quantity');
  });

  it('searches by name only (not sku) and filters by category', async () => {
    const byName = await request(app.getHttpServer())
      .get('/api/v1/catalog/products?search=zebra')
      .expect(200);
    expect(byName.body.meta.total).toBe(1);
    expect(byName.body.data[0].name).toBe('Zebra Pen');

    const bySku = await request(app.getHttpServer())
      .get('/api/v1/catalog/products?search=SEARCH-BY-SKU')
      .expect(200);
    expect(bySku.body.meta.total).toBe(0);
    expect(bySku.body.data).toEqual([]);

    const filtered = await request(app.getHttpServer())
      .get(`/api/v1/catalog/products?categoryId=${activeCategoryId}`)
      .expect(200);
    expect(filtered.body.meta.total).toBe(3);

    await request(app.getHttpServer())
      .get(`/api/v1/catalog/products?categoryId=${inactiveCategoryId}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.meta.total).toBe(0);
        expect(res.body.data).toEqual([]);
      });
  });

  it('paginates and sorts, and rejects limit above 50', async () => {
    const page1 = await request(app.getHttpServer())
      .get('/api/v1/catalog/products?page=1&limit=1&sort=name&order=asc')
      .expect(200);
    const page2 = await request(app.getHttpServer())
      .get('/api/v1/catalog/products?page=2&limit=1&sort=name&order=asc')
      .expect(200);

    expect(page1.body.meta).toEqual({
      page: 1,
      limit: 1,
      total: 3,
      totalPages: 3,
    });
    expect(page1.body.data).toHaveLength(1);
    expect(page2.body.data).toHaveLength(1);
    expect(page1.body.data[0].id).not.toBe(page2.body.data[0].id);

    const byPrice = await request(app.getHttpServer())
      .get('/api/v1/catalog/products?sort=price&order=asc')
      .expect(200);
    expect(byPrice.body.data.map((p: { price: number }) => p.price)).toEqual([
      2.5, 3, 10,
    ]);

    await request(app.getHttpServer())
      .get('/api/v1/catalog/products?limit=51')
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/v1/catalog/products?sort=sku')
      .expect(400);
  });

  it('lists only active categories without a token and without internal fields', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/catalog/categories')
      .expect(200);

    expect(Object.keys(res.body).sort()).toEqual(['data', 'meta']);
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
    expect(res.body.data).toEqual([
      {
        id: activeCategoryId,
        name: 'Office',
        description: 'Office supplies',
      },
    ]);
    for (const category of res.body.data) {
      expect(Object.keys(category).sort()).toEqual(CATEGORY_KEYS);
      expect(category).not.toHaveProperty('isActive');
      expect(category).not.toHaveProperty('createdAt');
      expect(category).not.toHaveProperty('updatedAt');
    }

    await request(app.getHttpServer())
      .get('/api/v1/catalog/categories?limit=51')
      .expect(400);
  });
});
