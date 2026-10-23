import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { StockMovementType } from '../generated/prisma/enums.js';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto.js';
import { ListMovementsQueryDto } from './dto/list-movements.query.dto.js';
import {
  ProductsService,
  PRODUCT_SELECT,
  serializeProduct,
  type ProductListResponse,
  type ProductResponse,
} from '../products/products.service.js';

/** Contract §3.6 `StockMovement` shape (all scalar fields). */
export interface MovementResponse {
  id: string;
  productId: string;
  type: StockMovementType;
  quantityChange: number;
  quantityAfter: number;
  reason: string | null;
  orderId: string | null;
  purchaseOrderId: string | null;
  createdById: string;
  createdAt: Date;
}

/** Movement list response — §1 pagination envelope. */
export interface MovementListResponse {
  data: MovementResponse[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/** `POST /stock/adjustments` response — the written movement plus the product. */
export interface AdjustedStockResponse {
  movement: MovementResponse;
  product: ProductResponse;
}

/**
 * Optional relation stamps passed by callers onto the movement row, plus
 * an option flag for special flows: `allowInactive` lets order
 * cancellations (#29) restore stock even if the product was soft-deleted
 * after the sale — the restore never fails for a deactivated product.
 */
interface MovementRefs {
  orderId?: string;
  purchaseOrderId?: string;
  allowInactive?: boolean;
}

const MOVEMENT_SELECT = {
  id: true,
  productId: true,
  type: true,
  quantityChange: true,
  quantityAfter: true,
  reason: true,
  orderId: true,
  purchaseOrderId: true,
  createdById: true,
  createdAt: true,
} satisfies Prisma.StockMovementSelect;

const P2034_RETRY_DELAY_MS = 50;

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
  ) {}

  /**
   * Adjust a product's quantity by a signed delta. The count update and the
   * `ADJUSTMENT` movement row are written inside ONE Serializable
   * transaction; P2034 write conflicts (two concurrent adjustments) are
   * retried once so neither run can observe the other's half-state.
   */
  async adjust(
    dto: CreateAdjustmentDto,
    userId: string,
    role: string,
  ): Promise<AdjustedStockResponse> {
    return this.withWriteRetry(() =>
      this.prisma.$transaction(
        (tx) =>
          this.applyStockChange(
            tx,
            dto.productId,
            dto.quantityChange,
            StockMovementType.ADJUSTMENT,
            dto.reason,
            userId,
            role,
          ),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  /**
   * Shared stock write used by adjustments today and by orders / purchase
   * orders later (#28, #32): callers open their own transaction and hand in
   * the transaction client, so product quantity and every related row stay
   * consistent.
   *
   * Implementation guarantees from the stock issue:
   * - one atomic conditional write (`updateMany` with a `quantity` guard +
   *   `increment` — never a blind read-then-write race);
   * - Postgres re-evaluates the guard against the locked row, so two
   *   concurrent decreases can never both pass ("stock never below zero");
   * - a zero-result write distinguishes 404 (missing) / 422 (inactive) /
   *   409 (insufficient stock) without racing;
   * - `quantityAfter` is re-read under the same transaction snapshot and
   *   computed server-side, never trusted from the client.
   */
  async applyStockChange(
    tx: Prisma.TransactionClient,
    productId: string,
    quantityChange: number,
    type: StockMovementType,
    reason: string | null,
    createdById: string,
    role: string,
    refs: MovementRefs = {},
  ): Promise<AdjustedStockResponse> {
    // For a negative change the request must hold at least |change| units.
    const guard: Prisma.ProductWhereInput =
      quantityChange < 0 ? { quantity: { gte: Math.abs(quantityChange) } } : {};

    // Cancellations restore stock even for soft-deleted products unless the
    // caller opted out of the active-product requirement via the refs.
    const { allowInactive = false, ...relationRefs } = refs;

    const { count } = await tx.product.updateMany({
      where: {
        id: productId,
        ...(allowInactive ? {} : { isActive: true }),
        ...guard,
      },
      data: { quantity: { increment: quantityChange } },
    });

    if (count === 0) {
      // The guard failed — classify WHY with a dedicated read before the
      // caller's transaction rolls back on our exception.
      const row = await tx.product.findUnique({
        where: { id: productId },
        select: { isActive: true },
      });

      if (!row) {
        throw new NotFoundException(`Product ${productId} not found`);
      }
      if (!row.isActive && !allowInactive) {
        throw new UnprocessableEntityException(
          `Product ${productId} is inactive`,
        );
      }
      throw new ConflictException(
        `Insufficient stock: product ${productId} change ${quantityChange} would push the quantity below zero`,
      );
    }

    const product = await tx.product.findUnique({
      where: { id: productId },
      select: PRODUCT_SELECT,
    });

    // With the guard satisfied this row cannot vanish mid-transaction
    // (products are never hard-deleted, AD-001); the check satisfies TS.
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    const quantityAfter = product.quantity;

    const movement = await tx.stockMovement.create({
      data: {
        productId,
        type,
        quantityChange,
        quantityAfter,
        reason,
        orderId: relationRefs.orderId,
        purchaseOrderId: relationRefs.purchaseOrderId,
        createdById,
      },
      select: MOVEMENT_SELECT,
    });

    return { movement, product: serializeProduct(product, role) };
  }

  /**
   * Paginated movement history with the §3.6 filters (`productId`, `type`,
   * `orderId`, `purchaseOrderId`, `from`/`to` date range) and a whitelisted
   * sort. The secondary `id` sort keeps tie ordering deterministic.
   */
  async findAll(query: ListMovementsQueryDto): Promise<MovementListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.StockMovementWhereInput = {
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.purchaseOrderId
        ? { purchaseOrderId: query.purchaseOrderId }
        : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [total, movements] = await Promise.all([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          {
            [sortBy]: sortOrder,
          } as Prisma.StockMovementOrderByWithRelationInput,
          { id: 'asc' },
        ],
        select: MOVEMENT_SELECT,
      }),
    ]);

    return this.toPage(movements, total, page, limit);
  }

  /**
   * One product's movement history. Missing product answers 404; inactive
   * products still resolve (AD-001 keeps history readable) — the query filter
   * is forced to the path id so caller-supplied `productId` cannot widen it.
   */
  async findForProduct(
    productId: string,
    query: ListMovementsQueryDto,
  ): Promise<MovementListResponse> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    return this.findAll({ ...query, productId });
  }

  /**
   * `GET /stock/low-stock` — contract §3.6: paginated `Product[]` where
   * `quantity <= minStock`, active only. Reuses the products service's
   * tested `stockStatus=low_stock` query (raw SQL + whitelisted ORDER BY)
   * and its role-aware serialization (AD-004: `costPrice` ADMIN only).
   * Only `page`/`limit` are exposed to callers; every other filter is
   * pinned server-side.
   */
  async lowStock(
    query: ListMovementsQueryDto,
    role: string,
  ): Promise<ProductListResponse> {
    return this.productsService.findAll(
      {
        page: query.page,
        limit: query.limit,
        stockStatus: 'low_stock',
        isActive: true,
      } as never,
      role,
    );
  }

  private toPage(
    data: MovementResponse[],
    total: number,
    page: number,
    limit: number,
  ): MovementListResponse {
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Users-module pattern: retry once when a serialization conflict hits. */
  private async withWriteRetry<T>(write: () => Promise<T>): Promise<T> {
    return write().catch((error: unknown) => {
      if (isWriteConflict(error)) {
        return sleep(P2034_RETRY_DELAY_MS).then(write);
      }
      throw error;
    });
  }
}

function isWriteConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2034'
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
