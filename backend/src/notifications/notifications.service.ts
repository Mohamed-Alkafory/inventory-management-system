import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationType } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { type ListNotificationsQueryDto } from './dto/list-notifications.query.dto.js';
import type { UpdatePreferencesDto } from './dto/update-preferences.dto.js';

/** Contract §3.9 `Notification` shape (all scalar fields). */
export interface NotificationResponse {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  data: unknown;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

/** Notification list response — §1 pagination envelope. */
export interface NotificationListResponse {
  data: NotificationResponse[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/** One `GET/PUT /notifications/preferences` row (defaults filled). */
export interface PreferenceResponse {
  type: NotificationType;
  enabled: boolean;
}

const NOTIFICATION_SELECT = {
  id: true,
  userId: true,
  type: true,
  title: true,
  message: true,
  entityType: true,
  entityId: true,
  data: true,
  isRead: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

const ALL_TYPES = Object.values(NotificationType) as NotificationType[];

const ADMIN_ROLE = 'ADMIN';

/** Product snapshot the fan-out needs to decide/serialize an alert. */
interface LowStockCandidate {
  id: string;
  name: string;
  quantity: number;
  minStock: number;
}

/** What a creating event hands over for the fan-out. */
interface NotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------
  // Read/update APIs (current user only — ownership forced server-side)
  // ------------------------------------------------------------------

  /** `GET /notifications` — own rows, `&type=&unread=` filters, whitelisted sort. */
  async findAll(
    userId: string,
    query: ListNotificationsQueryDto,
  ): Promise<NotificationListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.unread === undefined ? {} : { isRead: !query.unread }),
    };

    const [total, notifications] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          {
            [sortBy]: sortOrder,
          } as Prisma.NotificationOrderByWithRelationInput,
          { id: 'asc' },
        ],
        select: NOTIFICATION_SELECT,
      }),
    ]);

    return {
      data: notifications,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** `GET /notifications/unread-count` — own unread rows. */
  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  /**
   * `PATCH /notifications/:id/read` — sets `isRead` + `readAt`. A missing
   * row AND a row belonging to someone else both answer 404 (not-own stays
   * indistinguishable — contract §3.9).
   */
  async markRead(userId: string, id: string): Promise<NotificationResponse> {
    const row = await this.prisma.notification.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!row || row.userId !== userId) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
      select: NOTIFICATION_SELECT,
    });
    return updated;
  }

  /** `PATCH /notifications/read-all` — marks every own unread row. */
  async markAllRead(userId: string): Promise<{ updated: number }> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updated: count };
  }

  /**
   * `GET /notifications/preferences` — full type list for the current
   * user; rows not stored yet report the default (`enabled: true`).
   */
  async getPreferences(userId: string): Promise<PreferenceResponse[]> {
    const stored = await this.prisma.notificationPreference.findMany({
      where: { userId },
      select: { type: true, enabled: true },
    });
    const byType = new Map(stored.map((row) => [row.type, row.enabled]));

    return ALL_TYPES.map((type) => ({
      type,
      enabled: byType.get(type) ?? true,
    }));
  }

  /**
   * `PUT /notifications/preferences` — upserts each sent row, then returns
   * the full (default-filled) list.
   */
  async updatePreferences(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<PreferenceResponse[]> {
    for (const preference of dto.preferences) {
      await this.prisma.notificationPreference.upsert({
        where: {
          userId_type: { userId, type: preference.type },
        },
        create: { userId, type: preference.type, enabled: preference.enabled },
        update: { enabled: preference.enabled },
      });
    }

    return this.getPreferences(userId);
  }

  // ------------------------------------------------------------------
  // Best-effort event fan-out. EVERY method swallows its own errors — a
  // notification must never fail the main operation (#31). Callers invoke
  // them AFTER their transaction has committed, with the main client.
  // ------------------------------------------------------------------

  /**
   * LOW_STOCK — fired after a stock change bought a product to/below its
   * `minStock` (order sale, adjustment). Creates exactly ONE unread alert
   * per admin per product (no duplicate while an unread one exists).
   */
  async notifyLowStockIfDepleted(product: LowStockCandidate): Promise<void> {
    try {
      if (product.quantity > product.minStock) {
        return;
      }
      await this.fanOutToAdmins({
        type: NotificationType.LOW_STOCK,
        title: 'Low stock alert',
        message: `${product.name} is low on stock (${product.quantity} left, minimum ${product.minStock}).`,
        entityType: 'product',
        entityId: product.id,
        dedupePerUser: true,
      });
    } catch {
      // Notifications are best-effort — never fail the main operation.
    }
  }

  /** ORDER_CREATED — fired after an order commits (issue #28). */
  async notifyOrderCreated(order: {
    id: string;
    orderNumber: string;
    totalAmount: number;
  }): Promise<void> {
    try {
      await this.fanOutToAdmins({
        type: NotificationType.ORDER_CREATED,
        title: 'New order',
        message: `Order ${order.orderNumber} was created (total ${order.totalAmount}).`,
        entityType: 'order',
        entityId: order.id,
      });
    } catch {
      // best-effort
    }
  }

  /** ORDER_CANCELLED — fired after a cancellation commits (issue #29). */
  async notifyOrderCancelled(order: {
    id: string;
    orderNumber: string;
    totalAmount: number;
  }): Promise<void> {
    try {
      await this.fanOutToAdmins({
        type: NotificationType.ORDER_CANCELLED,
        title: 'Order cancelled',
        message: `Order ${order.orderNumber} was cancelled — stock restored.`,
        entityType: 'order',
        entityId: order.id,
      });
    } catch {
      // best-effort
    }
  }

  /**
   * Fan-out to every active ADMIN user. Explicit `enabled: false`
   * preferences remove a user from the target list; `dedupePerUser` skips
   * users who already hold an unread row for the same entity (LOW_STOCK).
   */
  private async fanOutToAdmins(
    input: NotificationInput & { dedupePerUser?: boolean },
  ): Promise<void> {
    try {
      const admins = await this.prisma.user.findMany({
        where: { role: ADMIN_ROLE, isActive: true },
        select: { id: true },
      });
      let targets = admins.map((admin) => admin.id);
      if (targets.length === 0) {
        return;
      }

      // Users who turned this type off never receive it.
      const optedOut = await this.prisma.notificationPreference.findMany({
        where: {
          userId: { in: targets },
          type: input.type,
          enabled: false,
        },
        select: { userId: true },
      });
      const optOuts = new Set(optedOut.map((row) => row.userId));
      targets = targets.filter((id) => !optOuts.has(id));
      if (targets.length === 0) {
        return;
      }

      // LOW_STOCK no-duplicate rule: skip users with an unread row for the
      // same entity (same product) still sitting in their inbox.
      if (input.dedupePerUser && input.entityId) {
        const existing = await this.prisma.notification.findMany({
          where: {
            userId: { in: targets },
            type: input.type,
            isRead: false,
            entityType: input.entityType,
            entityId: input.entityId,
          },
          select: { userId: true },
        });
        const already = new Set(existing.map((row) => row.userId));
        targets = targets.filter((id) => !already.has(id));
        if (targets.length === 0) {
          return;
        }
      }

      await this.prisma.notification.createMany({
        data: targets.map((userId) => ({
          userId,
          type: input.type,
          title: input.title,
          message: input.message,
          entityType: input.entityType,
          entityId: input.entityId,
        })),
      });
    } catch {
      // best-effort — the main operation must never fail on notifications
    }
  }
}
