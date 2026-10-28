import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { ProductImageService } from './product-image.service.js';

@Module({
  imports: [AuditModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductImageService],
  // Shared with the stock module: low-stock listing and role-aware
  // product serialization for adjustment responses.
  exports: [ProductsService],
})
export class ProductsModule {}
