import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { StockModule } from '../stock/stock.module.js';
import { PurchaseOrdersController } from './purchase-orders.controller.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';

/**
 * Purchase orders (#32): ADMIN creates/manually transitions, any role
 * receives. Receipts raise product stock through the shared stock write
 * (issue #17) with PURCHASE_RECEIPT movements, and fan a
 * PURCHASE_ORDER_RECEIVED notification post-commit (issue #31).
 */
@Module({
  imports: [StockModule, NotificationsModule, AuditModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
