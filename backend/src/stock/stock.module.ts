import { Module } from '@nestjs/common';

import { ProductsModule } from '../products/products.module.js';
import { StockController } from './stock.controller.js';
import { ProductMovementsController } from './product-movements.controller.js';
import { StockService } from './stock.service.js';

/**
 * Stock adjustments and the movement history. `ProductsModule` is imported
 * so the shared stock logic can serve `/stock/low-stock` (and any later
 * consumer) with the products service's tested query + serialization.
 */
@Module({
  imports: [ProductsModule],
  controllers: [StockController, ProductMovementsController],
  providers: [StockService],
})
export class StockModule {}
