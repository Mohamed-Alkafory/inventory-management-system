import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { StockModule } from '../stock/stock.module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

/**
 * Order creation (#28) reuses the shared stock write from the stock issue
 * (#17): quantity, movements and order rows are always kept consistent in
 * ONE transaction. `NotificationsModule` provides the post-commit
 * ORDER_CREATED / ORDER_CANCELLED / LOW_STOCK events (#31).
 */
@Module({
  imports: [StockModule, NotificationsModule, AuditModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
