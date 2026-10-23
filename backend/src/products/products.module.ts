import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
  // Shared with the stock module: low-stock listing and role-aware
  // product serialization for adjustment responses.
  exports: [ProductsService],
})
export class ProductsModule {}
