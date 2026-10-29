import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, OrderStatus } from '../generated/prisma/client.js';
import {
  PaymentMethod,
  StockMovementType,
  UserRole,
} from '../generated/prisma/enums.js';
import {
  StockService,
  type AdjustedStockResponse,
} from '../stock/stock.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { CreateOwnOrderDto } from './dto/create-own-order.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { ListOrdersQueryDto } from './dto/list-orders.query.dto.js';
import { ListOwnOrdersQueryDto } from './dto/list-own-orders.query.dto.js';
import { CreateOrderNoteDto } from './dto/create-order-note.dto.js';

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
  customerId: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  paymentMethod: PaymentMethod;
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

export interface OrderDetailResponse extends OrderResponse {
  items: OrderItemResponse[];
  createdBy: { id: string; name: string; email: string };
  stockMovements: Array<{
    id: string;
    productId: string;
    type: StockMovementType;
    quantityChange: number;
    quantityAfter: number;
    reason: string | null;
    createdAt: Date;
  }>;
}

export interface OrderListResponse {
  data: OrderResponse[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/** Internal order note shape — never exposed by a customer-facing response. */
export interface OrderNoteResponse {
  id: string;
  orderId: string;
  authorId: string;
  note: string;
  author: { id: string; name: string };
  createdAt: Date;
}

/**
 * Customer-facing item snapshot. Deliberately omits ids and product
 * references so an owner can never learn internal order/product metadata.
 */
export interface CustomerOrderItemResponse {
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/**
 * Customer-facing order shape. Only the documented fields are exposed —
 * never `createdBy`, stock movements, audit data or internal ids beyond the
 * order itself.
 */
export interface CustomerOrderResponse {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  items: CustomerOrderItemResponse[];
  recipientName: string | null;
  recipientPhone: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  paymentMethod: PaymentMethod;
  createdAt: Date;
  cancelledAt: Date | null;
}

export interface CustomerOrderListResponse {
  data: CustomerOrderResponse[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  customerName: true,
  customerPhone: true,
  notes: true,
  totalAmount: true,
  customerId: true,
  recipientName: true,
  recipientPhone: true,
  shippingAddress: true,
  shippingCity: true,
  paymentMethod: true,
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

const CUSTOMER_ORDER_ITEM_SELECT = {
  productName: true,
  sku: true,
  quantity: true,
  unitPrice: true,
  lineTotal: true,
} satisfies Prisma.OrderItemSelect;

const ORDER_NOTE_SELECT = {
  id: true,
  orderId: true,
  authorId: true,
  note: true,
  author: { select: { id: true, name: true } },
  createdAt: true,
} satisfies Prisma.OrderNoteSelect;

const CUSTOMER_ORDER_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  totalAmount: true,
  recipientName: true,
  recipientPhone: true,
  shippingAddress: true,
  shippingCity: true,
  paymentMethod: true,
  createdAt: true,
  cancelledAt: true,
  orderItems: { select: CUSTOMER_ORDER_ITEM_SELECT },
} satisfies Prisma.OrderSelect;

/**
 * Issue #29 transition rules. A cancelled order is terminal; going back to
 * PENDING or staying in the same status is a rejected transition (409).
 */
const STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.CANCELLED],
  CANCELLED: [],
};

const P2034_RETRY_DELAY_MS = 50;

/** Products fetched for snapshots/validation inside the transaction. */
interface ProductFacts {
  id: string;
  name: string;
  sku: string;
  price: Prisma.Decimal;
  isActive: boolean;
}

/**
 * Normalized input of the shared creation pipeline. Only `POST /orders/mine`
 * supplies `customerId` and the shipping fields; the staff path leaves them
 * undefined so Prisma skips the columns.
 */
interface CreateOrderRecordInput {
  items: Array<{ productId: string; quantity: number }>;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  createdById: string;
  role: string;
  customerId?: string;
  recipientName?: string;
  recipientPhone?: string;
  shippingAddress?: string;
  shippingCity?: string;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Create a staff order with its items and deduct stock — all in ONE
   * Serializable transaction (issue #28):
   *
   * 1. every line validated (amount ≥ 1, unique products, real + active);
   * 2. a sequential `ORDER-####` number generated from the row count;
   * 3. `unitPrice`/`lineTotal`/`totalAmount` computed server-side with
   *    decimal math — never trusted from the client;
   * 4. `Product.quantity` deducted and `SALE` movements stamped with the
   *    new order id through the shared stock logic (409 below zero);
   * 5. any failure throws inside the transaction — nothing partial remains.
   *
   * The staff endpoint keeps its existing contract: no customer id and no
   * shipping fields are stamped here.
   */
  async create(
    dto: CreateOrderDto,
    userId: string,
    role: string,
  ): Promise<CreatedOrderResponse> {
    return this.createOrderRecord({
      items: dto.items,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      notes: dto.notes,
      createdById: userId,
      role,
    });
  }

  /**
   * `POST /orders/mine` — a CUSTOMER places an order for themselves. The
   * shared creation transaction is reused; ownership (`customerId`) and
   * `createdById` come from the token, and the recipient details are copied
   * into `customerName`/`customerPhone` so staff views keep working.
   */
  async createMine(
    dto: CreateOwnOrderDto,
    userId: string,
    role: string,
  ): Promise<CustomerOrderResponse> {
    const result = await this.createOrderRecord({
      items: dto.items,
      customerName: dto.recipientName,
      customerPhone: dto.recipientPhone,
      notes: dto.notes,
      createdById: userId,
      role,
      customerId: userId,
      recipientName: dto.recipientName,
      recipientPhone: dto.recipientPhone,
      shippingAddress: dto.shippingAddress,
      shippingCity: dto.shippingCity,
    });

    return serializeCustomerOrder({
      ...result,
      orderItems: result.items,
    });
  }

  /**
   * Shared creation pipeline for both the staff and customer endpoints.
   * Exactly one Serializable transaction covers order + item snapshots +
   * stock writes + audit, and the best-effort notifications fire only after
   * the commit.
   */
  private async createOrderRecord(
    input: CreateOrderRecordInput,
  ): Promise<CreatedOrderResponse> {
    // DTO validation covers field shapes; cross-line duplication is a
    // service-level 400 before any transaction opens. The
    // @@unique([orderId, productId]) index remains the DB backstop.
    const ids = input.items.map((item) => item.productId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Duplicate productId in items');
    }

    // Filled by the transaction callback with each line's stock result, so
    // LOW_STOCK alerts can fire after the commit (issue #31).
    const soldProducts: AdjustedStockResponse[] = [];

    const result = await this.withWriteRetry(() =>
      this.prisma.$transaction(
        (tx) => this.createOrder(tx, input, ids, soldProducts),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );

    // Committed — best-effort events (never throw, issue #31). A customer
    // order also alerts the shop floor; staff-created orders keep the
    // existing ADMIN-only target.
    const createdEvent = {
      id: result.id,
      orderNumber: result.orderNumber,
      totalAmount: result.totalAmount,
    };
    if (input.customerId) {
      await this.notifications.notifyOrderCreated(createdEvent, {
        roles: [UserRole.STAFF, UserRole.ADMIN],
      });
    } else {
      await this.notifications.notifyOrderCreated(createdEvent);
    }
    for (const change of soldProducts) {
      await this.notifications.notifyLowStockIfDepleted(change.product);
    }

    return result;
  }

  private async createOrder(
    tx: Prisma.TransactionClient,
    input: CreateOrderRecordInput,
    ids: string[],
    soldProducts: AdjustedStockResponse[],
  ): Promise<CreatedOrderResponse> {
    // Snapshot source + existence/active validation (404/422) in one read.
    const rows = (await tx.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, sku: true, price: true, isActive: true },
    })) as ProductFacts[];
    const byId = new Map<string, ProductFacts>(rows.map((r) => [r.id, r]));

    for (const item of input.items) {
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
    const lines = input.items.map((item) => {
      const unit = new Prisma.Decimal(byId.get(item.productId)!.price);
      const line = unit.mul(item.quantity);
      total = total.add(line);
      return { item, product: byId.get(item.productId)!, unit, line };
    });

    const order = await tx.order.create({
      data: {
        orderNumber,
        status: OrderStatus.PENDING,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        notes: input.notes,
        totalAmount: total,
        createdById: input.createdById,
        ...(input.customerId !== undefined
          ? { customerId: input.customerId }
          : {}),
        ...(input.recipientName !== undefined
          ? { recipientName: input.recipientName }
          : {}),
        ...(input.recipientPhone !== undefined
          ? { recipientPhone: input.recipientPhone }
          : {}),
        ...(input.shippingAddress !== undefined
          ? { shippingAddress: input.shippingAddress }
          : {}),
        ...(input.shippingCity !== undefined
          ? { shippingCity: input.shippingCity }
          : {}),
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
    // insufficient stock) throws here and rolls the whole order back. Each
    // result is kept for the post-commit LOW_STOCK fan-out (issue #31).
    for (const { item } of lines) {
      const change = await this.stock.applyStockChange(
        tx,
        item.productId,
        -item.quantity,
        StockMovementType.SALE,
        null,
        input.createdById,
        input.role,
        { orderId: order.id },
      );
      soldProducts.push(change);
    }

    // Issue #34: one entry per created order, committed with the order.
    await this.audit.log(
      {
        userId: input.createdById,
        action: 'order.created',
        entityType: 'order',
        entityId: order.id,
        newValues: {
          orderNumber: order.orderNumber,
          status: order.status,
          totalAmount: total,
          customerId: order.customerId,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          recipientName: order.recipientName,
          recipientPhone: order.recipientPhone,
          shippingAddress: order.shippingAddress,
          shippingCity: order.shippingCity,
          paymentMethod: order.paymentMethod,
          notes: order.notes,
          items,
        },
      },
      tx,
    );

    return { ...serializeOrder(order), items };
  }

  /**
   * Move an order through its statuses (#29). Valid transitions: PENDING →
   * CONFIRMED, PENDING → CANCELLED, CONFIRMED → CANCELLED; anything else —
   * including re-touching the current status or a cancelled order — is 409.
   *
   * Cancelling RESTORES stock for every line in the SAME Serializable
   * transaction (`RETURN` movements referencing the order): a
   * status-conditional write makes double-cancels a no-op (409), so stock
   * can never be restored twice. The whole write is retried once on
   * transaction conflicts.
   */
  async updateStatus(
    id: string,
    dto: UpdateOrderStatusDto,
    userId: string,
    role: string,
  ): Promise<CreatedOrderResponse> {
    const result = await this.withWriteRetry(() =>
      this.prisma.$transaction(
        (tx) => this.updateOrderStatus(tx, id, dto, userId, role),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );

    // Committed — best-effort event (never throws, issue #31). The customer
    // is included only when the order is owned by one.
    if (dto.newStatus === OrderStatus.CANCELLED) {
      await this.notifications.notifyOrderCancelled({
        id: result.id,
        orderNumber: result.orderNumber,
        totalAmount: result.totalAmount,
        ...(result.customerId ? { customerId: result.customerId } : {}),
      });
    } else if (dto.newStatus === OrderStatus.CONFIRMED) {
      await this.notifications.notifyOrderConfirmed({
        id: result.id,
        orderNumber: result.orderNumber,
        ...(result.customerId ? { customerId: result.customerId } : {}),
      });
    }

    return result;
  }

  /**
   * `POST /orders/mine/:id/cancel` — a CUSTOMER cancels one of their own
   * PENDING orders. Reuses the exact staff cancellation transaction with an
   * ownership scope: an unknown id and another customer's order both answer
   * 404 (never 403), and the status-conditional write keeps a double cancel
   * a 409 that never restores stock twice.
   */
  async cancelMine(
    id: string,
    userId: string,
    role: string,
  ): Promise<CustomerOrderResponse> {
    const result = await this.withWriteRetry(() =>
      this.prisma.$transaction(
        (tx) =>
          this.updateOrderStatus(
            tx,
            id,
            { newStatus: OrderStatus.CANCELLED },
            userId,
            role,
            { customerId: userId, pendingOnly: true },
          ),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );

    await this.notifications.notifyOrderCancelled({
      id: result.id,
      orderNumber: result.orderNumber,
      totalAmount: result.totalAmount,
      ...(result.customerId ? { customerId: result.customerId } : {}),
    });

    return serializeCustomerOrder({
      ...result,
      orderItems: result.items,
    });
  }

  /**
   * `POST /orders/:id/cancel` — SUPPORT (and STAFF/ADMIN) cancel a PENDING
   * order on the customer's behalf. It deliberately reuses the same cancel
   * transaction as the staff status route (stock restored exactly once with
   * RETURN movements and audited), but `pendingOnly` forbids CONFIRMED or any
   * other status. A non-PENDING order — including a double cancel — is 409.
   */
  async cancelPending(
    id: string,
    userId: string,
    role: string,
  ): Promise<CreatedOrderResponse> {
    const result = await this.withWriteRetry(() =>
      this.prisma.$transaction(
        (tx) =>
          this.updateOrderStatus(
            tx,
            id,
            { newStatus: OrderStatus.CANCELLED },
            userId,
            role,
            { pendingOnly: true },
          ),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );

    await this.notifications.notifyOrderCancelled({
      id: result.id,
      orderNumber: result.orderNumber,
      totalAmount: result.totalAmount,
      ...(result.customerId ? { customerId: result.customerId } : {}),
    });

    return result;
  }

  private async updateOrderStatus(
    tx: Prisma.TransactionClient,
    id: string,
    dto: UpdateOrderStatusDto,
    userId: string,
    role: string,
    options?: { customerId?: string; pendingOnly?: boolean },
  ): Promise<CreatedOrderResponse> {
    const select = {
      id: true,
      orderNumber: true,
      status: true,
      cancelledAt: true,
    } as const;

    // Owner-scoped reads use findFirst so "not found" and "not yours" are
    // indistinguishable to the caller (both 404).
    const order = options?.customerId
      ? await tx.order.findFirst({
          where: { id, customerId: options.customerId },
          select,
        })
      : await tx.order.findUnique({ where: { id }, select });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    // Customers and the SUPPORT cancel route may only cancel PENDING orders.
    // STAFF/ADMIN keep the wider CONFIRMED → CANCELLED transition from issue
    // #29 on PATCH /orders/:id/status.
    if (options?.pendingOnly && order.status !== OrderStatus.PENDING) {
      throw new ConflictException(
        `Order ${order.orderNumber} can only be cancelled while PENDING`,
      );
    }

    if (!STATUS_TRANSITIONS[order.status].includes(dto.newStatus)) {
      throw new ConflictException(
        `Order ${order.orderNumber} cannot transition from ${order.status} to ${dto.newStatus}`,
      );
    }

    // Backstop against races the isolation level may let through: the write
    // is still conditioned on the status we validated a moment ago (and on
    // ownership for customer cancels).
    const { count } = await tx.order.updateMany({
      where: {
        id,
        status: order.status,
        ...(options?.customerId ? { customerId: options.customerId } : {}),
      },
      data:
        dto.newStatus === OrderStatus.CANCELLED
          ? { status: dto.newStatus, cancelledAt: new Date() }
          : { status: dto.newStatus },
    });
    if (count === 0) {
      throw new ConflictException(
        `Order ${order.orderNumber} changed status concurrently`,
      );
    }

    // Cancellation restores every line's quantity and records one `RETURN`
    // movement per line, all inside this same transaction. Soft-deleted
    // (inactive) products still receive their stock back (AD-001 rows are
    // never removed) — the allowance is passed via the shared stock refs.
    if (dto.newStatus === OrderStatus.CANCELLED) {
      const lines = await tx.orderItem.findMany({
        where: { orderId: id },
        select: { productId: true, quantity: true },
      });

      for (const line of lines) {
        await this.stock.applyStockChange(
          tx,
          line.productId,
          line.quantity,
          StockMovementType.RETURN,
          `Cancelled order ${order.orderNumber}`,
          userId,
          role,
          { orderId: order.id, allowInactive: true },
        );
      }
    }

    const updated = await tx.order.findUnique({
      where: { id },
      select: ORDER_SELECT,
    });

    // The conditional write above matched, so the row exists; satisfies TS.
    if (!updated) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    const items = await tx.orderItem.findMany({
      where: { orderId: id },
      select: ORDER_ITEM_SELECT,
    });

    // Issue #34: cancellations record the status change (and stock restore
    // is covered by the resulting RETURN movements) in the same transaction.
    if (dto.newStatus === OrderStatus.CANCELLED) {
      await this.audit.log(
        {
          userId,
          action: 'order.cancelled',
          entityType: 'order',
          entityId: id,
          oldValues: { status: order.status, cancelledAt: order.cancelledAt },
          newValues: {
            status: updated.status,
            cancelledAt: updated.cancelledAt,
            totalAmount: updated.totalAmount,
          },
        },
        tx,
      );
    }

    return { ...serializeOrder(updated), items: items.map(serializeItem) };
  }

  /**
   * `GET /orders` — paginated, filterable by status, createdById, search, date range,
   * sorted by status or createdAt.
   */
  async findAll(
    query: ListOrdersQueryDto,
    role?: string,
  ): Promise<OrderListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
      throw new BadRequestException(
        'from date must be before or equal to to date',
      );
    }

    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.createdById ? { createdById: query.createdById } : {}),
      ...(query.search
        ? {
            OR: [
              { orderNumber: { contains: query.search, mode: 'insensitive' } },
              { customerName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
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

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          { [sortBy]: sortOrder } as Prisma.OrderOrderByWithRelationInput,
          { id: 'asc' },
        ],
        select: ORDER_SELECT,
      }),
    ]);

    return {
      data: orders.map((order) => serializeOrderForList(order, role)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * `GET /orders/mine` — the authenticated customer's own orders, newest
   * first, with an optional status filter. Ownership is forced server-side.
   */
  async findMine(
    query: ListOwnOrdersQueryDto,
    customerId: string,
  ): Promise<CustomerOrderListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.OrderWhereInput = {
      customerId,
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: CUSTOMER_ORDER_SELECT,
      }),
    ]);

    return {
      data: orders.map(serializeCustomerOrder),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * `GET /orders/mine/:id` — one own order. A missing order and another
   * customer's order both answer 404 so ownership cannot be probed.
   */
  async findMineOne(
    id: string,
    customerId: string,
  ): Promise<CustomerOrderResponse> {
    const order = await this.prisma.order.findFirst({
      where: { id, customerId },
      select: CUSTOMER_ORDER_SELECT,
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    return serializeCustomerOrder(order);
  }

  /**
   * `GET /orders/:id` — returns order fields plus items[], createdBy, and
   * stockMovements[]. SUPPORT and STAFF detail views are audited because this
   * is where the full personal data is exposed; the entry contains only the
   * viewer and order identity, never the PII itself.
   */
  async findOne(
    id: string,
    viewerId?: string,
    viewerRole?: string,
  ): Promise<OrderDetailResponse> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: {
          select: ORDER_ITEM_SELECT,
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        stockMovements: {
          select: {
            id: true,
            productId: true,
            type: true,
            quantityChange: true,
            quantityAfter: true,
            reason: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    if (viewerId && (viewerRole === 'SUPPORT' || viewerRole === 'STAFF')) {
      await this.audit.log({
        userId: viewerId,
        action: 'order.viewed',
        entityType: 'order',
        entityId: order.id,
        newValues: { viewerId, viewerRole },
      });
    }

    return {
      ...serializeOrder(order),
      items: order.orderItems.map(serializeItem),
      createdBy: order.createdBy,
      stockMovements: order.stockMovements,
    };
  }

  /** `POST /orders/:id/notes` — append an internal note (never customer-visible). */
  async createNote(
    orderId: string,
    dto: CreateOrderNoteDto,
    authorId: string,
  ): Promise<OrderNoteResponse> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    return this.prisma.orderNote.create({
      data: { orderId, authorId, note: dto.note },
      select: ORDER_NOTE_SELECT,
    });
  }

  /** `GET /orders/:id/notes` — the internal note thread, oldest first. */
  async findNotes(orderId: string): Promise<OrderNoteResponse[]> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    return this.prisma.orderNote.findMany({
      where: { orderId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: ORDER_NOTE_SELECT,
    });
  }

  /**
   * `PATCH /orders/:id` — metadata update only (customerName, customerPhone, notes).
   * Contract §3.7: Allowed only while order is PENDING; 422 if not PENDING.
   */
  async update(
    id: string,
    dto: UpdateOrderDto,
    userId: string,
  ): Promise<OrderResponse> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: ORDER_SELECT,
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new UnprocessableEntityException(
        `Order ${id} is ${order.status}; only PENDING orders can be edited`,
      );
    }

    const data: Prisma.OrderUpdateInput = {};
    if (dto.customerName !== undefined) data.customerName = dto.customerName;
    if (dto.customerPhone !== undefined) data.customerPhone = dto.customerPhone;
    if (dto.notes !== undefined) data.notes = dto.notes;

    const updated = await this.prisma.order.update({
      where: { id },
      data,
      select: ORDER_SELECT,
    });

    await this.audit.log({
      userId,
      action: 'order.updated',
      entityType: 'order',
      entityId: id,
      oldValues: {
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        notes: order.notes,
      },
      newValues: {
        customerName: updated.customerName,
        customerPhone: updated.customerPhone,
        notes: updated.notes,
      },
    });

    return serializeOrder(updated);
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

/**
 * SUPPORT list rows deliberately omit the phone columns (both `customerPhone`
 * and the mirrored `recipientPhone`) and the shipping address. The detail
 * route still returns them, but every SUPPORT/STAFF detail view is audited.
 */
function serializeOrderForList(
  order: Prisma.OrderGetPayload<{
    select: typeof ORDER_SELECT;
  }>,
  role?: string,
): OrderResponse {
  const serialized = serializeOrder(order);

  if (role !== 'SUPPORT') {
    return serialized;
  }

  const minimized = { ...serialized } as Partial<OrderResponse>;
  delete minimized.customerPhone;
  delete minimized.recipientPhone;
  delete minimized.shippingAddress;
  return minimized as OrderResponse;
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

/** Row shape accepted by the customer serializer (Prisma or already mapped). */
interface CustomerOrderRow {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: Prisma.Decimal | number;
  recipientName: string | null;
  recipientPhone: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  paymentMethod: PaymentMethod;
  createdAt: Date;
  cancelledAt: Date | null;
  orderItems: Array<{
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: Prisma.Decimal | number;
    lineTotal: Prisma.Decimal | number;
  }>;
}

/**
 * Explicit allow-list: a customer response can only ever contain these
 * fields, whatever the underlying row happens to include.
 */
function serializeCustomerOrder(order: CustomerOrderRow): CustomerOrderResponse {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    totalAmount: Number(order.totalAmount),
    items: order.orderItems.map((item) => ({
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
    })),
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    shippingAddress: order.shippingAddress,
    shippingCity: order.shippingCity,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt,
    cancelledAt: order.cancelledAt,
  };
}
