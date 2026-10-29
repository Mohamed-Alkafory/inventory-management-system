import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { CatalogService, MAX_ORDERABLE_CAP } from './catalog.service.js';
import { type ListCatalogProductsQueryDto } from './dto/list-catalog-products.query.dto.js';
import { type ListCatalogCategoriesQueryDto } from './dto/list-catalog-categories.query.dto.js';

const CATEGORY_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PRODUCT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

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

function productRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PRODUCT_ID,
    sku: 'OFF-PEN-002',
    name: 'Ballpoint Pen',
    description: 'Blue ink',
    price: new Prisma.Decimal('1.99'),
    imageUrl: null,
    quantity: 25,
    category: { id: CATEGORY_ID, name: 'Office' },
    ...overrides,
  };
}

function categoryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CATEGORY_ID,
    name: 'Office',
    description: 'Office supplies',
    ...overrides,
  };
}

describe('CatalogService', () => {
  let service: CatalogService;
  const productCount = vi.fn();
  const productFindMany = vi.fn();
  const productFindFirst = vi.fn();
  const categoryCount = vi.fn();
  const categoryFindMany = vi.fn();

  beforeEach(async () => {
    productCount.mockReset().mockResolvedValue(1);
    productFindMany.mockReset().mockResolvedValue([productRow()]);
    productFindFirst.mockReset().mockResolvedValue(productRow());
    categoryCount.mockReset().mockResolvedValue(1);
    categoryFindMany.mockReset().mockResolvedValue([categoryRow()]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        {
          provide: PrismaService,
          useValue: {
            product: {
              count: productCount,
              findMany: productFindMany,
              findFirst: productFindFirst,
            },
            category: {
              count: categoryCount,
              findMany: categoryFindMany,
            },
          },
        },
      ],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
  });

  describe('findProducts', () => {
    it('returns only the public fields and converts price/quantity safely', async () => {
      const result = await service.findProducts(
        {} as ListCatalogProductsQueryDto,
      );

      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
      expect(Object.keys(result).sort()).toEqual(['data', 'meta']);
      expect(Object.keys(result.data[0]).sort()).toEqual(PRODUCT_KEYS);
      expect(Object.keys(result.data[0].category).sort()).toEqual([
        'id',
        'name',
      ]);
      expect(result.data[0]).toMatchObject({
        id: PRODUCT_ID,
        sku: 'OFF-PEN-002',
        name: 'Ballpoint Pen',
        description: 'Blue ink',
        price: 1.99,
        imageUrl: null,
        category: { id: CATEGORY_ID, name: 'Office' },
        inStock: true,
        maxOrderable: MAX_ORDERABLE_CAP,
      });
      expect(typeof result.data[0].price).toBe('number');

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
        expect(result.data[0]).not.toHaveProperty(forbidden);
      }
    });

    it('selects only safe columns and filters to active products/categories', async () => {
      await service.findProducts({} as ListCatalogProductsQueryDto);

      expect(productCount).toHaveBeenCalledWith({
        where: {
          isActive: true,
          category: { is: { isActive: true } },
        },
      });
      expect(productFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            category: { is: { isActive: true } },
          },
          skip: 0,
          take: 20,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          select: {
            id: true,
            sku: true,
            name: true,
            description: true,
            price: true,
            imageUrl: true,
            quantity: true,
            category: { select: { id: true, name: true } },
          },
        }),
      );
    });

    it('applies search, category, pagination and an explicit sort/order', async () => {
      await service.findProducts({
        page: 2,
        limit: 10,
        search: 'pen',
        categoryId: CATEGORY_ID,
        sort: 'price',
        order: 'asc',
      } as ListCatalogProductsQueryDto);

      expect(productCount).toHaveBeenCalledWith({
        where: {
          isActive: true,
          category: { is: { isActive: true } },
          categoryId: CATEGORY_ID,
          name: { contains: 'pen', mode: 'insensitive' },
        },
      });
      expect(productFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
          orderBy: [{ price: 'asc' }, { id: 'asc' }],
        }),
      );
    });

    it('defaults `newest` to desc and name/price to asc', async () => {
      await service.findProducts({
        sort: 'newest',
      } as ListCatalogProductsQueryDto);
      expect(productFindMany.mock.calls[0][0].orderBy).toEqual([
        { createdAt: 'desc' },
        { id: 'asc' },
      ]);

      await service.findProducts({
        sort: 'name',
      } as ListCatalogProductsQueryDto);
      expect(productFindMany.mock.calls[1][0].orderBy).toEqual([
        { name: 'asc' },
        { id: 'asc' },
      ]);
    });

    it('caps maxOrderable at the named constant and reports out-of-stock as 0', async () => {
      productCount.mockResolvedValue(3);
      productFindMany.mockResolvedValue([
        productRow({ id: '1', quantity: MAX_ORDERABLE_CAP + 99 }),
        productRow({ id: '2', quantity: 3 }),
        productRow({ id: '3', quantity: 0 }),
      ]);

      const { data } = await service.findProducts(
        {} as ListCatalogProductsQueryDto,
      );

      expect(data.map((p) => p.maxOrderable)).toEqual([
        MAX_ORDERABLE_CAP,
        3,
        0,
      ]);
      expect(data.map((p) => p.inStock)).toEqual([true, true, false]);
    });

    it('computes totalPages from the matching row count', async () => {
      productCount.mockResolvedValue(45);

      const result = await service.findProducts({
        limit: 20,
      } as ListCatalogProductsQueryDto);

      expect(result.meta).toMatchObject({ total: 45, totalPages: 3 });
    });
  });

  describe('findProduct', () => {
    it('reads only an active product in an active category and returns safe fields', async () => {
      const result = await service.findProduct(PRODUCT_ID);

      expect(productFindFirst).toHaveBeenCalledWith({
        where: {
          id: PRODUCT_ID,
          isActive: true,
          category: { is: { isActive: true } },
        },
        select: expect.anything(),
      });
      expect(Object.keys(result).sort()).toEqual(PRODUCT_KEYS);
    });

    it('answers 404 for unknown, inactive or inactive-category products', async () => {
      productFindFirst.mockResolvedValue(null);

      await expect(
        service.findProduct('00000000-0000-4000-8000-000000000000'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findCategories', () => {
    it('returns active categories only with a safe explicit shape', async () => {
      const result = await service.findCategories(
        {} as ListCatalogCategoriesQueryDto,
      );

      expect(categoryCount).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      expect(categoryFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          skip: 0,
          take: 20,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          select: { id: true, name: true, description: true },
        }),
      );
      expect(Object.keys(result.data[0]).sort()).toEqual(CATEGORY_KEYS);
      expect(result.data[0]).toEqual(categoryRow());
    });

    it('applies the public page/limit', async () => {
      await service.findCategories({
        page: 3,
        limit: 5,
      } as ListCatalogCategoriesQueryDto);

      expect(categoryFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });
  });
});
