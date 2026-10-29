import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, PurchaseOrderStatus } from '../generated/prisma/client.js';
import { StockMovementType } from '../generated/prisma/enums.js';
import { StockService } from '../stock/stock.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto.js';
import { UpdatePurchaseOrderStatusDto } from './dto/update-status.dto.js';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto.js';
import { type ListPurchaseOrdersQueryDto } from './dto/list-purchase-orders.query.dto.js';

/**
 * Contract §3.8 `PurchaseOrder` scalar shape. `totalAmount` is
 * Decimal(12,2) in the DB and serialized as a number.
 */
export interface PurchaseOrderResponse {
  id: string;
  orderNumber: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  totalAmount: number;
  expectedAt: Date | null;
  receivedAt: Date | null;
  notes: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Contract §3.8 `PurchaseOrderItem` shape — `unitCost` is client input. */
export interface PurchaseOrderItemResponse {
  id: string;
  purchaseOrderId: string;
  productId: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  /** Included so the UI can show product name/sku without extra requests. */
  product: { id: string; name: string; sku: string };
}

/** Detail responses (GET :id, create, transitions, receive) carry items + supplier. */
export interface PurchaseOrderDetailResponse extends PurchaseOrderResponse {
  supplier: { id: string; companyName: string };
  items: PurchaseOrderItemResponse[];
}

/** Purchase-order list response — §1 pagination envelope. */
export interface PurchaseOrderListResponse {
  data: PurchaseOrderResponse[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const PO_SELECT = {
  id: true,
  orderNumber: true,
  supplierId: true,
  status: true,
  totalAmount: true,
  expectedAt: true,
  receivedAt: true,
  notes: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PurchaseOrderSelect;

const PO_ITEM_SELECT = {
  id: true,
  purchaseOrderId: true,
  productId: true,
  quantityOrdered: true,
  quantityReceived: true,
  unitCost: true,
  product: { select: { id: true, name: true, sku: true } },
} satisfies Prisma.PurchaseOrderItemSelect;

const PO_DETAIL_SELECT = {
  ...PO_SELECT,
  supplier: { select: { id: true, companyName: true } },
  items: { select: PO_ITEM_SELECT },
} satisfies Prisma.PurchaseOrderSelect;

/**
 * Manual transitions (issue #32): DRAFT → ORDERED and DRAFT|ORDERED →
 * CANCELLED. Everything else is either a 409 (touching a terminal/
 * receiving state) or happens exclusively through `/receive`
 * (ORDERED → PARTIALLY_RECEIVED → RECEIVED).
 */
const STATUS_TRANSITIONS: Record<
  PurchaseOrderStatus,
  readonly PurchaseOrderStatus[]
> = {
  DRAFT: [PurchaseOrderStatus.ORDERED, PurchaseOrderStatus.CANCELLED],
  ORDERED: [PurchaseOrderStatus.CANCELLED],
  PARTIALLY_RECEIVED: [],
  RECEIVED: [],
  CANCELLED: [],
};

const P2034_RETRY_DELAY_MS = 50;

/** Rows read in the receive transaction. */
interface PurchaseOrderLine {
  id: string;
  productId: string;
  quantityOrdered: number;
  quantityReceived: number;
}

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * `GET /purchase-orders` — paginated, filterable by status and supplier,
   * whitelisted sort.
   */
  async findAll(
    query: ListPurchaseOrdersQueryDto,
  ): Promise<PurchaseOrderListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.PurchaseOrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    };

    const [total, orders] = await Promise.all([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          {
            [sortBy]: sortOrder,
          } as Prisma.PurchaseOrderOrderByWithRelationInput,
          { id: 'asc' },
        ],
        select: PO_SELECT,
      }),
    ]);

    return {
      data: orders.map(serializeOrder),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** `GET /purchase-orders/:id` — detail with items and supplier. */
  async findOne(id: string): Promise<PurchaseOrderDetailResponse> {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      select: PO_DETAIL_SELECT,
    });

    if (!order) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }

    return serializeDetail(order);
  }

  /**
   * POST /purchase-orders (issue #32) — validate supplier + every product
   * line, generate a sequential `PO-####`number, compute totals with
   * decimal math and write the order **with all items in ONE Serializable
   * transaction**. NO stock changes happen yet (that is what receiving is
   * for); a `P2002` orderNumber race is retried by the wrapper.
   */
  async create(
    dto: CreatePurchaseOrderDto,
    userId: string,
  ): Promise<PurchaseOrderDetailResponse> {
    // DTO validation covers field shapes; cross-line duplication is a
    // service-level 400 before any transaction opens. The unique
    // @@index([purchaseOrderId, productId]) remains the DB backstop.
    const ids = dto.items.map((item) => item.productId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Duplicate productId in items');
    }

    const result = await this.withWriteRetry(() =>
      this.prisma.$transaction(
        (tx) => this.createPurchaseOrder(tx, dto, ids, userId),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );

    // No notifications yet: a DRAFT purchase order is only paperwork.
    return result;
  }

  private async createPurchaseOrder(
    tx: Prisma.TransactionClient,
    dto: CreatePurchaseOrderDto,
    ids: string[],
    userId: string,
  ): Promise<PurchaseOrderDetailResponse> {
    const supplier = await tx.supplier.findUnique({
      where: { id: dto.supplierId },
      select: { id: true, companyName: true, isActive: true },
    });
    if (!supplier) {
      throw new NotFoundException(`Supplier ${dto.supplierId} not found`);
    }
    if (!supplier.isActive) {
      throw new UnprocessableEntityException(
        `Supplier ${dto.supplierId} is inactive`,
      );
    }

    // Snapshot source + existence/active validation (404/422) in one read.
    const products = await tx.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, isActive: true },
    });
    const byId = new Map(products.map((row) => [row.id, row]));

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

    // Sequential readable number (e.g. PO-0001). Rows are never removed
    // (AD-001), so the count only grows; a concurrent race is retried by
    // the wrapper (the unique index re-kicks the conflict).
    const count = await tx.purchaseOrder.count();
    const orderNumber = `PO-${String(count + 1).padStart(4, '0')}`;

    const lines = dto.items.map((item) => {
      const unit = new Prisma.Decimal(item.unitCost);
      const line = unit.mul(item.quantityOrdered);
      return { item, unit, line };
    });
    const total = lines.reduce(
      (acc, { line }) => acc.add(line),
      new Prisma.Decimal(0),
    );

    const order = await tx.purchaseOrder.create({
      data: {
        orderNumber,
        supplierId: dto.supplierId,
        status: PurchaseOrderStatus.DRAFT,
        totalAmount: total,
        expectedAt: dto.expectedAt,
        notes: dto.notes,
        createdById: userId,
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            quantityOrdered: item.quantityOrdered,
            unitCost: new Prisma.Decimal(item.unitCost),
          })),
        },
      },
      select: PO_DETAIL_SELECT,
    });

    return serializeDetail(order);
  }

  /**
   * PATCH /purchase-orders/:id/status (issue #32). Manual moves only —
   * DRAFT → ORDERED and DRAFT|ORDERED → CANCELLED; anything else
   * (re-touching the current status, ordering a partial one, receiving
   * manually, resurrecting a cancelled order) is 409. Cancelling a
   * purchase order touches NO stock: product quantities only ever moved
   * when receipt lines were accepted, and those never change on cancel.
   */
  async updateStatus(
    id: string,
    dto: UpdatePurchaseOrderStatusDto,
  ): Promise<PurchaseOrderDetailResponse> {
    return this.withWriteRetry(() =>
      this.prisma.$transaction((tx) => this.transitionStatus(tx, id, dto), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    );
  }

  private async transitionStatus(
    tx: Prisma.TransactionClient,
    id: string,
    dto: UpdatePurchaseOrderStatusDto,
  ): Promise<PurchaseOrderDetailResponse> {
    const order = await tx.purchaseOrder.findUnique({
      where: { id },
      select: { id: true, orderNumber: true, status: true },
    });

    if (!order) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }

    if (!STATUS_TRANSITIONS[order.status].includes(dto.newStatus)) {
      throw new ConflictException(
        `Purchase order ${order.orderNumber} cannot transition from ${order.status} to ${dto.newStatus}`,
      );
    }

    // Backstop against races the isolation level may let through: the write
    // is still conditioned on the status we validated a moment ago.
    const { count } = await tx.purchaseOrder.updateMany({
      where: { id, status: order.status },
      data: { status: dto.newStatus },
    });
    if (count === 0) {
      throw new ConflictException(
        `Purchase order ${order.orderNumber} changed status concurrently`,
      );
    }

    const updated = await tx.purchaseOrder.findUnique({
      where: { id },
      select: PO_DETAIL_SELECT,
    });

    // The conditional write above matched, so the row exists; satisfies TS.
    if (!updated) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }

    // userId/role currently only flow through for movement bookkeeping —
    // no stock is touched on manual transitions.
    return serializeDetail(updated);
  }

  /**
   * POST /purchase-orders/:id/receive (issue #32) — bring ordered stock
   * into the shop, all in ONE Serializable transaction:
   *
   * 1. every line validated (quantity ≥ 1, unique products, product on
   *    the PO, remaining quantity sufficient — 409 on over-receive);
   * 2. `quantityReceived` incremented per line and product stock raised
   *    with one `PURCHASE_RECEIPT` movement per line (shared stock logic);
   * 3. the status becomes `RECEIVED` (everything arrived — `receivedAt`
   *    stamped) or `PARTIALLY_RECEIVED`; the write is conditioned on the
   *    receiving-eligible status as a race backstop.
   *
   * Any failure throws inside the transaction — nothing partial remains.
   */
  async receive(
    id: string,
    dto: ReceivePurchaseOrderDto,
    userId: string,
    role: string,
  ): Promise<PurchaseOrderDetailResponse> {
    const result = await this.withWriteRetry(() =>
      this.prisma.$transaction(
        (tx) => this.receiveLines(tx, id, dto, userId, role),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );

    // Committed — best-effort event (never throws, issue #32).
    await this.notifications.notifyPurchaseOrderReceived({
      id: result.id,
      orderNumber: result.orderNumber,
    });

    return result;
  }

  private async receiveLines(
    tx: Prisma.TransactionClient,
    id: string,
    dto: ReceivePurchaseOrderDto,
    userId: string,
    role: string,
  ): Promise<PurchaseOrderDetailResponse> {
    const order = await tx.purchaseOrder.findUnique({
      where: { id },
      select: { id: true, orderNumber: true, status: true },
    });

    if (!order) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }

    const receivingEligible =
      order.status === PurchaseOrderStatus.ORDERED ||
      order.status === PurchaseOrderStatus.PARTIALLY_RECEIVED;

    if (!receivingEligible) {
      const why =
        order.status === PurchaseOrderStatus.DRAFT
          ? 'order it first (PATCH status → ORDERED)'
          : 'cancelled and already-received orders are terminal';
      throw new ConflictException(
        `Purchase order ${order.orderNumber} (${order.status}) cannot be received — ${why}`,
      );
    }

    const receivedIds = dto.items.map((item) => item.productId);
    if (new Set(receivedIds).size !== receivedIds.length) {
      throw new BadRequestException('Duplicate productId in items');
    }

    const lines = (await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId: id },
      select: {
        id: true,
        productId: true,
        quantityOrdered: true,
        quantityReceived: true,
      },
    })) as PurchaseOrderLine[];
    const byProductId = new Map(lines.map((line) => [line.productId, line]));

    for (const item of dto.items) {
      const line = byProductId.get(item.productId);
      if (!line) {
        throw new BadRequestException(
          `Product ${item.productId} is not a line of purchase order ${order.orderNumber}`,
        );
      }
      const remaining = line.quantityOrdered - line.quantityReceived;
      if (item.quantity > remaining) {
        throw new ConflictException(
          `Product ${item.productId}: remaining quantity is ${remaining}, received ${item.quantity}`,
        );
      }
    }

    // All lines validated — apply quantity + stock + movement per line.
    for (const item of dto.items) {
      const line = byProductId.get(item.productId)!;

      await tx.purchaseOrderItem.updateMany({
        where: { id: line.id },
        data: { quantityReceived: { increment: item.quantity } },
      });

      await this.stock.applyStockChange(
        tx,
        item.productId,
        item.quantity,
        StockMovementType.PURCHASE_RECEIPT,
        `Received purchase order ${order.orderNumber}`,
        userId,
        role,
        { purchaseOrderId: id },
      );
    }

    // Everything received → RECEIVED (with receivedAt); otherwise the PO
    // stays actionable as PARTIALLY_RECEIVED. The write is conditioned on
    // the status validated above as a race backstop.
    const refreshed = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId: id },
      select: { quantityOrdered: true, quantityReceived: true },
    });
    const fullyReceived = refreshed.every(
      (line) => line.quantityReceived >= line.quantityOrdered,
    );

    const { count } = await tx.purchaseOrder.updateMany({
      where: { id, status: order.status },
      data: fullyReceived
        ? { status: PurchaseOrderStatus.RECEIVED, receivedAt: new Date() }
        : { status: PurchaseOrderStatus.PARTIALLY_RECEIVED },
    });
    if (count === 0) {
      throw new ConflictException(
        `Purchase order ${order.orderNumber} changed status concurrently`,
      );
    }

    const updated = await tx.purchaseOrder.findUnique({
      where: { id },
      select: PO_DETAIL_SELECT,
    });

    if (!updated) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }

    // Issue #34: record the receipt (lines + resulting status) in the same
    // transaction as the stock and quantity changes.
    await this.audit.log(
      {
        userId,
        action: 'purchase_order.received',
        entityType: 'purchase_order',
        entityId: id,
        oldValues: { status: order.status },
        newValues: {
          status: updated.status,
          receivedAt: updated.receivedAt,
          items: dto.items,
        },
      },
      tx,
    );

    return serializeDetail(updated);
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
  order: Prisma.PurchaseOrderGetPayload<{ select: typeof PO_SELECT }>,
): PurchaseOrderResponse {
  return {
    ...order,
    totalAmount: Number(order.totalAmount),
  };
}

function serializeItem(
  item: Prisma.PurchaseOrderItemGetPayload<{ select: typeof PO_ITEM_SELECT }>,
): PurchaseOrderItemResponse {
  return {
    ...item,
    unitCost: Number(item.unitCost),
  };
}

/** Detail responses carry the order's item rows and supplier snapshot. */
function serializeDetail(
  order: Prisma.PurchaseOrderGetPayload<{ select: typeof PO_DETAIL_SELECT }>,
): PurchaseOrderDetailResponse {
  return {
    ...order,
    totalAmount: Number(order.totalAmount),
    supplier: order.supplier,
    items: order.items.map(serializeItem),
  };
}
