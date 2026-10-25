import { Module } from '@nestjs/common';

import { ProductsModule } from '../products/products.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { StockController } from './stock.controller.js';
import { ProductMovementsController } from './product-movements.controller.js';
import { StockService } from './stock.service.js';

/**
 * Stock adjustments and the movement history. `ProductsModule` is imported
 * so the shared stock logic can serve `/stock/low-stock` (and any later
 * consumer) with the products service's tested query + serialization.
 */
@Module({
  imports: [ProductsModule, NotificationsModule, AuditModule],
  controllers: [StockController, ProductMovementsController],
  providers: [StockService],
  // Shared with orders (#28) and purchase orders (#32): applyStockChange
  // keeps quantity, movement history and order rows consistent in ONE tx.
  exports: [StockService],
})
export class StockModule {}
