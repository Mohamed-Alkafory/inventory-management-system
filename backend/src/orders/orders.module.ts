import { Module } from '@nestjs/common';

import { StockModule } from '../stock/stock.module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

/**
 * Order creation (#28) reuses the shared stock write from the stock issue
 * (#17): quantity, movements and order rows are always kept consistent in
 * ONE transaction.
 */
@Module({
  imports: [StockModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
