import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ImageStorageModule } from '../storage/image-storage.module.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  imports: [AuditModule, ImageStorageModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  // Shared with the stock module: low-stock listing and role-aware
  // product serialization for adjustment responses.
  exports: [ProductsService],
})
export class ProductsModule {}
