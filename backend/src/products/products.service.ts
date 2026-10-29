import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import {
  ListProductsQueryDto,
  type ProductSortableField,
} from './dto/list-products.query.dto.js';
import {
  ImageStorageService,
  type UploadedImageFile,
} from '../storage/image-storage.service.js';

/**
 * Contract §3.4 `Product` shape. `price`/`costPrice` are Decimal(12,2) in the
 * DB and serialized as numbers (matching the existing GET /products behavior).
 * `costPrice` is ADMIN-only (AD-004): STAFF responses omit the field entirely,
 * they never receive `null` instead.
 */
export interface ProductResponse {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  barcode: string | null;
  price: number;
  /** Present only for ADMIN, omitted for STAFF (AD-004). */
  costPrice?: number | null;
  quantity: number;
  minStock: number;
  isActive: boolean;
  categoryId: string;
  supplierId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Contract §3.4 list response — §1 pagination envelope. */
export interface ProductListResponse {
  data: ProductResponse[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/**
 * A product row as returned by either the typed Prisma client or the
 * `low_stock` raw query (NUMERIC arrives as Decimal/string there).
 */
interface ProductRowLike {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  barcode: string | null;
  price: Prisma.Decimal | number | string;
  costPrice: Prisma.Decimal | number | string | null;
  quantity: number;
  minStock: number;
  isActive: boolean;
  categoryId: string;
  supplierId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PRODUCT_SELECT = {
  id: true,
  sku: true,
  name: true,
  description: true,
  imageUrl: true,
  barcode: true,
  price: true,
  costPrice: true,
  quantity: true,
  minStock: true,
  isActive: true,
  categoryId: true,
  supplierId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;

/** Shared with the stock module (adjustment responses, low-stock listing). */
export { PRODUCT_SELECT };

const ADMIN_ROLE = 'ADMIN';

/** snake_case columns for the whitelist-ordered raw `low_stock` query. */
const SORT_COLUMNS: Record<ProductSortableField, string> = {
  name: 'name',
  sku: 'sku',
  price: 'price',
  quantity: 'quantity',
  createdAt: 'created_at',
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly images: ImageStorageService,
  ) {}

  /**
   * Paginated, filtered and sorted product list (contract §3.4). Response
   * shape stays compatible with the pre-existing GET /products fields, in the
   * §1 pagination envelope. Default listing shows active products only
   * (AD-001 — soft-deleted rows disappear from the listing; they still
   * resolve by id) — an explicit `isActive` query param overrides that.
   */
  async findAll(
    query: ListProductsQueryDto,
    role: string,
  ): Promise<ProductListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    if (query.stockStatus === 'low_stock') {
      const { data, total } = await this.findLowStockPage(
        query,
        page,
        limit,
        sortBy,
        sortOrder,
        role,
      );
      return this.toPage(data, total, page, limit);
    }

    const where: Prisma.ProductWhereInput = {
      isActive: query.isActive ?? true,
      ...(query.categoryId !== undefined
        ? { categoryId: query.categoryId }
        : {}),
      ...(query.supplierId !== undefined
        ? { supplierId: query.supplierId }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.stockStatus === 'in_stock' ? { quantity: { gt: 0 } } : {}),
      ...(query.stockStatus === 'out_of_stock'
        ? { quantity: { equals: 0 } }
        : {}),
    };

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        // Secondary `id` sort keeps the ordering deterministic on ties.
        orderBy: [
          { [sortBy]: sortOrder } as Prisma.ProductOrderByWithRelationInput,
          { id: 'asc' },
        ],
        select: PRODUCT_SELECT,
      }),
    ]);

    return this.toPage(
      products.map((product) => serializeProduct(product, role)),
      total,
      page,
      limit,
    );
  }

  /**
   * `stockStatus=low_stock` (`quantity <= minStock`) compares two columns,
   * which typed Prisma filters cannot express. It needs a raw query: the
   * `WHERE` fragments are built with `Prisma.sql` (bound parameters), and the
   * ORDER BY identifiers come from a whitelist enum, never from user input.
   */
  private async findLowStockPage(
    query: ListProductsQueryDto,
    page: number,
    limit: number,
    sortBy: ProductSortableField,
    sortOrder: 'asc' | 'desc',
    role: string,
  ): Promise<{ data: ProductResponse[]; total: number }> {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`quantity <= min_stock`,
      Prisma.sql`is_active = ${query.isActive ?? true}`,
    ];

    if (query.search) {
      // Escape the LIKE wildcards so `%`/`_` match literally, as they do in
      // the typed `contains` path.
      const like = `%${query.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      conditions.push(Prisma.sql`(name ILIKE ${like} OR sku ILIKE ${like})`);
    }
    if (query.categoryId !== undefined) {
      conditions.push(Prisma.sql`category_id = ${query.categoryId}`);
    }
    if (query.supplierId !== undefined) {
      conditions.push(Prisma.sql`supplier_id = ${query.supplierId}`);
    }

    const where = Prisma.join(conditions, ' AND ');
    const orderBy = SORT_COLUMNS[sortBy] + ' ' + sortOrder.toUpperCase();

    const [countRows, rows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ total: number }>>(
        Prisma.sql`SELECT COUNT(*)::int AS total FROM products WHERE ${where}`,
      ),
      this.prisma.$queryRaw<Array<ProductRowLike>>(
        Prisma.sql`SELECT id, sku, name, description,
                 image_url AS "imageUrl", barcode, price, cost_price AS "costPrice",
                 quantity, min_stock AS "minStock", is_active AS "isActive",
                 category_id AS "categoryId", supplier_id AS "supplierId",
                 created_at AS "createdAt", updated_at AS "updatedAt"
               FROM products
               WHERE ${where}
               ORDER BY ${Prisma.raw(orderBy)}, id ASC
               LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      ),
    ]);

    return {
      data: rows.map((row) => serializeProduct(row, role)),
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  private toPage(
    data: ProductResponse[],
    total: number,
    page: number,
    limit: number,
  ): ProductListResponse {
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Detail by id. Inactive (soft-deleted) products still resolve — the list
   * hides them, AD-001 keeps them resolvable for history/reference — and the
   * `isActive` flag lets clients render the tombstone state.
   */
  async findOne(id: string, role: string): Promise<ProductResponse> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: PRODUCT_SELECT,
    });

    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return serializeProduct(product, role);
  }

  async create(
    dto: CreateProductDto,
    userId?: string,
  ): Promise<ProductResponse> {
    // Contract §3.4: 404 when the product references a nonexistent
    // category/supplier. Checked up front so the API error is precise
    // (a DB FK failure would surface as a generic P2003 conflict).
    await this.assertCategoryExists(dto.categoryId);
    // Explicit `null` means "no supplier", the same as omitting the field.
    if (dto.supplierId !== undefined && dto.supplierId !== null) {
      await this.assertSupplierExists(dto.supplierId);
    }

    const product = await this.prisma.product.create({
      data: {
        sku: dto.sku,
        name: dto.name,
        description: dto.description,
        imageUrl: dto.imageUrl,
        barcode: dto.barcode,
        price: dto.price,
        costPrice: dto.costPrice,
        quantity: dto.quantity,
        minStock: dto.minStock,
        categoryId: dto.categoryId,
        supplierId: dto.supplierId,
      },
      select: PRODUCT_SELECT,
    });

    await this.audit.log({
      userId,
      action: 'product.created',
      entityType: 'product',
      entityId: product.id,
      newValues: product,
    });

    return serializeProduct(product, ADMIN_ROLE);
  }

  /**
   * Partial update. `quantity` is intentionally not assignable (AD-005 —
   * stock changes flow through the stock service) and neither is `isActive`
   * (AD-001 — deactivation is the DELETE soft delete). Duplicate
   * `sku`/`barcode` hits the unique index and the global Prisma filter
   * answers 409.
   */
  async update(
    id: string,
    dto: UpdateProductDto,
    userId?: string,
  ): Promise<ProductResponse> {
    const where = { id };
    const existing = await this.prisma.product.findUnique({
      where,
      select: PRODUCT_SELECT,
    });

    if (!existing) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    if (dto.categoryId !== undefined) {
      await this.assertCategoryExists(dto.categoryId);
    }
    if (dto.supplierId !== undefined && dto.supplierId !== null) {
      await this.assertSupplierExists(dto.supplierId);
    }

    const data: Prisma.ProductUncheckedUpdateInput = {};
    if (dto.sku !== undefined) {
      data.sku = dto.sku;
    }
    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
    }
    if (dto.imageUrl !== undefined) {
      data.imageUrl = dto.imageUrl;
    }
    if (dto.barcode !== undefined) {
      data.barcode = dto.barcode;
    }
    if (dto.price !== undefined) {
      data.price = dto.price;
    }
    if (dto.costPrice !== undefined) {
      data.costPrice = dto.costPrice;
    }
    if (dto.minStock !== undefined) {
      data.minStock = dto.minStock;
    }
    if (dto.categoryId !== undefined) {
      data.categoryId = dto.categoryId;
    }
    if (dto.supplierId !== undefined) {
      data.supplierId = dto.supplierId;
    }

    const product = await this.prisma.product.update({
      where,
      data,
      select: PRODUCT_SELECT,
    });

    // Issue #34: the old snapshot and the new row make price changes
    // auditable (`oldValues.price` → `newValues.price`).
    await this.audit.log({
      userId,
      action: 'product.updated',
      entityType: 'product',
      entityId: id,
      oldValues: existing,
      newValues: product,
    });

    return serializeProduct(product, ADMIN_ROLE);
  }

  /**
   * Replaces a product image with an uploaded file. The new file is written
   * first; if the database update fails it is removed again so no orphan is
   * left behind. The previous local file is deleted only after the DB commit.
   */
  async uploadImage(
    id: string,
    file: UploadedImageFile | undefined,
    userId?: string,
  ): Promise<ProductResponse> {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: PRODUCT_SELECT,
    });

    if (!existing) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    const imageUrl = await this.images.save(file, 'products');

    let product: Prisma.ProductGetPayload<{ select: typeof PRODUCT_SELECT }>;
    try {
      product = await this.prisma.product.update({
        where: { id },
        data: { imageUrl },
        select: PRODUCT_SELECT,
      });
    } catch (error) {
      await this.images.delete(imageUrl);
      throw error;
    }

    await this.images.delete(existing.imageUrl);

    await this.audit.log({
      userId,
      action: 'product.image_updated',
      entityType: 'product',
      entityId: id,
      oldValues: existing,
      newValues: product,
    });

    return serializeProduct(product, ADMIN_ROLE);
  }

  /**
   * Clears a product image. The local file is removed only after the database
   * update succeeds; external URLs are never touched on disk.
   */
  async removeImage(id: string, userId?: string): Promise<void> {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: PRODUCT_SELECT,
    });

    if (!existing) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: { imageUrl: null },
      select: PRODUCT_SELECT,
    });

    await this.images.delete(existing.imageUrl);

    await this.audit.log({
      userId,
      action: 'product.image_deleted',
      entityType: 'product',
      entityId: id,
      oldValues: existing,
      newValues: product,
    });
  }

  /**
   * AD-001 soft delete: set `isActive = false`, never remove the row.
   * Idempotent-ish: deactivating twice keeps `isActive = false`.
   */
  async remove(id: string, userId?: string): Promise<void> {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: PRODUCT_SELECT,
    });

    if (!existing) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
      select: { id: true },
    });

    await this.audit.log({
      userId,
      action: 'product.deleted',
      entityType: 'product',
      entityId: id,
      oldValues: existing,
      newValues: { ...existing, isActive: false },
    });
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException(`Category ${categoryId} not found`);
    }
  }

  private async assertSupplierExists(supplierId: string): Promise<void> {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier ${supplierId} not found`);
    }
  }
}

/**
 * Serializes a product row for API responses. Prices are Numbers; `costPrice`
 * is included only for ADMIN (AD-004) — STAFF responses omit the field.
 * Shared with the stock module (adjustment responses, low-stock listing).
 */
export function serializeProduct(
  product: ProductRowLike,
  role: string,
): ProductResponse {
  const { price, costPrice, ...rest } = product;
  const response: ProductResponse = {
    ...rest,
    price: Number(price),
  };

  if (role === ADMIN_ROLE) {
    response.costPrice = costPrice === null ? null : Number(costPrice);
  }

  return response;
}
