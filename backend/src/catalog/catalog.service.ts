import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  type CatalogCategoryListResponseDto,
  type CatalogCategoryResponseDto,
  type CatalogProductListResponseDto,
  type CatalogProductResponseDto,
} from './dto/catalog.responses.js';
import {
  type CatalogSortField,
  type ListCatalogProductsQueryDto,
} from './dto/list-catalog-products.query.dto.js';
import { type ListCatalogCategoriesQueryDto } from './dto/list-catalog-categories.query.dto.js';

/**
 * Storefront cap for a single order line. `maxOrderable` is
 * `min(Product.quantity, MAX_ORDERABLE_CAP)` — the real quantity itself is
 * never exposed, so this constant is the only public bound.
 */
export const MAX_ORDERABLE_CAP = 20;

/**
 * Explicit allow-list for the public product query. The nested category
 * object deliberately selects only `id`/`name`; nothing else from either row
 * is loaded, so a future column cannot leak by accident.
 */
const CATALOG_PRODUCT_SELECT = {
  id: true,
  sku: true,
  name: true,
  description: true,
  price: true,
  imageUrl: true,
  quantity: true,
  category: { select: { id: true, name: true } },
} satisfies Prisma.ProductSelect;

const CATALOG_CATEGORY_SELECT = {
  id: true,
  name: true,
  description: true,
} satisfies Prisma.CategorySelect;

type CatalogProductRow = Prisma.ProductGetPayload<{
  select: typeof CATALOG_PRODUCT_SELECT;
}>;

type CatalogCategoryRow = Prisma.CategoryGetPayload<{
  select: typeof CATALOG_CATEGORY_SELECT;
}>;

const SORT_COLUMNS = {
  name: 'name',
  price: 'price',
  newest: 'createdAt',
} as const satisfies Record<CatalogSortField, string>;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `GET /catalog/products` — only active products in active categories.
   * Search is name-only; pagination, category filter and sort/order are
   * validated by the DTO. The `id` tie-break makes every page deterministic.
   */
  async findProducts(
    query: ListCatalogProductsQueryDto,
  ): Promise<CatalogProductListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sort = query.sort ?? 'newest';
    // `newest` reads naturally descending; alphabetic/price lists ascending.
    const order = query.order ?? (sort === 'newest' ? 'desc' : 'asc');

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      category: { is: { isActive: true } },
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          {
            [SORT_COLUMNS[sort]]: order,
          } as Prisma.ProductOrderByWithRelationInput,
          { id: 'asc' },
        ],
        select: CATALOG_PRODUCT_SELECT,
      }),
    ]);

    return {
      data: rows.map(serializeProduct),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * `GET /catalog/products/:id` — unknown, inactive or active-in-an-inactive-
   * category all answer the same 404 so a hidden product is indistinguishable
   * from a missing one.
   */
  async findProduct(id: string): Promise<CatalogProductResponseDto> {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        isActive: true,
        category: { is: { isActive: true } },
      },
      select: CATALOG_PRODUCT_SELECT,
    });

    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return serializeProduct(product);
  }

  /** `GET /catalog/categories` — active categories only, name then id. */
  async findCategories(
    query: ListCatalogCategoriesQueryDto,
  ): Promise<CatalogCategoryListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.CategoryWhereInput = { isActive: true };

    const [total, rows] = await Promise.all([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: CATALOG_CATEGORY_SELECT,
      }),
    ]);

    return {
      data: rows.map(serializeCategory),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

/**
 * Explicit response serializer. Never spread Prisma rows: every returned
 * field is listed deliberately and `quantity` becomes the coarse
 * `inStock`/`maxOrderable` pair.
 */
function serializeProduct(
  product: CatalogProductRow,
): CatalogProductResponseDto {
  const inStock = product.quantity > 0;

  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    price: Number(product.price),
    imageUrl: product.imageUrl,
    category: {
      id: product.category.id,
      name: product.category.name,
    },
    inStock,
    maxOrderable: inStock ? Math.min(product.quantity, MAX_ORDERABLE_CAP) : 0,
  };
}

function serializeCategory(
  category: CatalogCategoryRow,
): CatalogCategoryResponseDto {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
  };
}
