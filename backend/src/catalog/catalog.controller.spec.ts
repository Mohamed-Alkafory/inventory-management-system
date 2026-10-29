import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import {
  CatalogController,
  CATALOG_THROTTLE_LIMIT,
} from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { ListCatalogProductsQueryDto } from './dto/list-catalog-products.query.dto.js';
import { ListCatalogCategoriesQueryDto } from './dto/list-catalog-categories.query.dto.js';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator.js';

const PRODUCT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CATEGORY_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const sampleProduct = {
  id: PRODUCT_ID,
  sku: 'OFF-PEN-002',
  name: 'Ballpoint Pen',
  description: 'Blue ink',
  price: 1.99,
  imageUrl: null,
  category: { id: CATEGORY_ID, name: 'Office' },
  inStock: true,
  maxOrderable: 20,
};

const sampleProductPage = {
  data: [sampleProduct],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

const sampleCategoryPage = {
  data: [{ id: CATEGORY_ID, name: 'Office', description: 'Office supplies' }],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

// @nestjs/throttler's constants are internal; its decorator stores them as
// `THROTTLER:LIMIT` / `THROTTLER:TTL` plus the throttler name (`default`).
const THROTTLER_LIMIT_KEY = 'THROTTLER:LIMITdefault';
const THROTTLER_TTL_KEY = 'THROTTLER:TTLdefault';

describe('CatalogController', () => {
  let controller: CatalogController;
  let reflector: Reflector;
  const findProducts = vi.fn();
  const findProduct = vi.fn();
  const findCategories = vi.fn();

  beforeEach(async () => {
    findProducts.mockReset().mockResolvedValue(sampleProductPage);
    findProduct.mockReset().mockResolvedValue(sampleProduct);
    findCategories.mockReset().mockResolvedValue(sampleCategoryPage);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        {
          provide: CatalogService,
          useValue: { findProducts, findProduct, findCategories },
        },
      ],
    }).compile();

    controller = module.get<CatalogController>(CatalogController);
    reflector = module.get(Reflector);
  });

  it('forwards the product list query to the service', async () => {
    const query = {
      page: 2,
      limit: 10,
      search: 'pen',
      sort: 'price',
      order: 'asc',
    } as ListCatalogProductsQueryDto;

    await expect(controller.findProducts(query)).resolves.toBe(
      sampleProductPage,
    );
    expect(findProducts).toHaveBeenCalledWith(query);
  });

  it('forwards the product id to the service', async () => {
    await expect(controller.findProduct(PRODUCT_ID)).resolves.toBe(
      sampleProduct,
    );
    expect(findProduct).toHaveBeenCalledWith(PRODUCT_ID);
  });

  it('forwards the category list query to the service', async () => {
    const query = { page: 1, limit: 50 } as ListCatalogCategoriesQueryDto;

    await expect(controller.findCategories(query)).resolves.toBe(
      sampleCategoryPage,
    );
    expect(findCategories).toHaveBeenCalledWith(query);
  });

  it.each(['findProducts', 'findProduct', 'findCategories'] as const)(
    '%s is public and carries the stricter 30/min throttle metadata',
    (method) => {
      const handler = (
        CatalogController.prototype as unknown as Record<string, unknown>
      )[method] as () => void;

      expect(reflector.get<boolean>(IS_PUBLIC_KEY, handler)).toBe(true);
      expect(Reflect.getMetadata(THROTTLER_LIMIT_KEY, handler)).toBe(
        CATALOG_THROTTLE_LIMIT,
      );
      expect(Reflect.getMetadata(THROTTLER_TTL_KEY, handler)).toBe(60_000);
      // The private API default is 100/60s, so anonymous catalog is stricter.
      expect(CATALOG_THROTTLE_LIMIT).toBeLessThan(100);
    },
  );

  describe('query validation', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    const validateProducts = (value: unknown) =>
      pipe.transform(value, {
        type: 'query',
        metatype: ListCatalogProductsQueryDto,
      });

    it('accepts the documented product query bounds', async () => {
      await expect(
        validateProducts({
          page: '2',
          limit: '50',
          search: 'pen',
          categoryId: CATEGORY_ID,
          sort: 'newest',
          order: 'desc',
        }),
      ).resolves.toMatchObject({
        page: 2,
        limit: 50,
        sort: 'newest',
        order: 'desc',
      });
    });

    it.each([
      ['limit above 50', { limit: '51' }],
      ['page 0', { page: '0' }],
      ['unknown sort', { sort: 'sku' }],
      ['unknown order', { order: 'sideways' }],
      ['invalid categoryId', { categoryId: 'not-a-uuid' }],
      ['unknown query field', { isActive: 'true' }],
    ])('rejects %s with 400', async (_label, query) => {
      await expect(validateProducts(query)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('caps category pagination at 50 too', async () => {
      const validateCategories = (value: unknown) =>
        pipe.transform(value, {
          type: 'query',
          metatype: ListCatalogCategoriesQueryDto,
        });

      await expect(
        validateCategories({ page: '1', limit: '51' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
