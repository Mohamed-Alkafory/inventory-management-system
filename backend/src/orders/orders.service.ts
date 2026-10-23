import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, OrderStatus } from '../generated/prisma/client.js';
import { StockMovementType } from '../generated/prisma/enums.js';
import { StockService } from '../stock/stock.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';

/**
 * Contract §3.7 `Order` scalar shape. `totalAmount` is Decimal(12,2) in the
 * DB and serialized as a number.
 */
export interface OrderResponse {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;
  totalAmount: number;
  createdById: string;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Contract §3.7 `OrderItem` shape — `productName`/`sku`/`unitPrice` are snapshots. */
export interface OrderItemResponse {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/** `POST /orders` response — the order plus its items (201). */
export interface CreatedOrderResponse extends OrderResponse {
  items: OrderItemResponse[];
}

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  customerName: true,
  customerPhone: true,
  notes: true,
  totalAmount: true,
  createdById: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrderSelect;

const ORDER_ITEM_SELECT = {
  id: true,
  orderId: true,
  productId: true,
  productName: true,
  sku: true,
  quantity: true,
  unitPrice: true,
  lineTotal: true,
} satisfies Prisma.OrderItemSelect;

const P2034_RETRY_DELAY_MS = 50;

/** Products fetched for snapshots/validation inside the transaction. */
interface ProductFacts {
  id: string;
  name: string;
  sku: string;
  price: Prisma.Decimal;
  isActive: boolean;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  /**
   * Create an order with its items and deduct stock — all in ONE
   * Serializable transaction (issue #28):
   *
   * 1. every line validated (amount ≥ 1, unique products, real + active);
   * 2. a sequential `ORDER-####` number generated from the row count;
   * 3. `unitPrice`/`lineTotal`/`totalAmount` computed server-side with
   *    decimal math — never trusted from the client;
   * 4. `Product.quantity` deducted and `SALE` movements stamped with the
   *    new order id through the shared stock logic (409 below zero);
   * 5. any failure throws inside the transaction — nothing partial remains.
   */
  async create(
    dto: CreateOrderDto,
    userId: string,
    role: string,
  ): Promise<CreatedOrderResponse> {
    // DTO validation covers field shapes; cross-line duplication is a
    // service-level 400 before any transaction opens. The
    // @@unique([orderId, productId]) index remains the DB backstop.
    const ids = dto.items.map((item) => item.productId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Duplicate productId in items');
    }

    return this.withWriteRetry(() =>
      this.prisma.$transaction(
        (tx) => this.createOrder(tx, dto, ids, userId, role),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  private async createOrder(
    tx: Prisma.TransactionClient,
    dto: CreateOrderDto,
    ids: string[],
    userId: string,
    role: string,
  ): Promise<CreatedOrderResponse> {
    // Snapshot source + existence/active validation (404/422) in one read.
    const rows = (await tx.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, sku: true, price: true, isActive: true },
    })) as ProductFacts[];
    const byId = new Map<string, ProductFacts>(rows.map((r) => [r.id, r]));

    for (const item of dto.items) {
      const product = byId.get(item.productId);
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }
      if (!product.isActive) {
        throw new UnprocessableEntityException(
          `Product ${item.productId} is inactive`,
        );
      }
    }

    // Sequential readable number (e.g. ORD-0001). Rows are never removed
    // (AD-001), so the count only grows; a concurrent race is retried by
    // the wrapper (the unique index re-kicks the conflict).
    const count = await tx.order.count();
    const orderNumber = `ORD-${String(count + 1).padStart(4, '0')}`;

    let total = new Prisma.Decimal(0);
    const lines = dto.items.map((item) => {
      const unit = new Prisma.Decimal(byId.get(item.productId)!.price);
      const line = unit.mul(item.quantity);
      total = total.add(line);
      return { item, product: byId.get(item.productId)!, unit, line };
    });

    const order = await tx.order.create({
      data: {
        orderNumber,
        status: OrderStatus.PENDING,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        notes: dto.notes,
        totalAmount: total,
        createdById: userId,
      },
      select: ORDER_SELECT,
    });

    const items: OrderItemResponse[] = [];
    for (const { item, product, unit, line } of lines) {
      const row = await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId,
          productName: product.name,
          sku: product.sku,
          quantity: item.quantity,
          unitPrice: unit,
          lineTotal: line,
        },
        select: ORDER_ITEM_SELECT,
      });
      items.push(serializeItem(row));
    }

    // Shared stock write (issue #17): one guarded atomic decrement per line
    // + one SALE movement stamping this order id. ANY failure (e.g. 409
    // insufficient stock) throws here and rolls the whole order back.
    for (const { item } of lines) {
      await this.stock.applyStockChange(
        tx,
        item.productId,
        -item.quantity,
        StockMovementType.SALE,
        null,
        userId,
        role,
        { orderId: order.id },
      );
    }

    return { ...serializeOrder(order), items };
  }

  /** Users-module pattern: retry a Serializable write conflict once. */
  private async withWriteRetry<T>(write: () => Promise<T>): Promise<T> {
    return write().catch((error: unknown) => {
      if (isRetryable(error)) {
        return sleep(P2034_RETRY_DELAY_MS).then(write);
      }
      throw error;
    });
  }
}

/** P2034 (Serializable conflict) and P2002 (orderNumber race) retry paths. */
function isRetryable(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2034' || error.code === 'P2002')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function serializeOrder(
  order: Prisma.OrderGetPayload<{
    select: typeof ORDER_SELECT;
  }>,
): OrderResponse {
  return {
    ...order,
    totalAmount: Number(order.totalAmount),
  };
}

function serializeItem(
  item: Prisma.OrderItemGetPayload<{
    select: typeof ORDER_ITEM_SELECT;
  }>,
): OrderItemResponse {
  return {
    ...item,
    unitPrice: Number(item.unitPrice),
    lineTotal: Number(item.lineTotal),
  };
}
