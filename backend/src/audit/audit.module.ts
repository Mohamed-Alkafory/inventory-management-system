import { Module } from '@nestjs/common';

import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';

/**
 * Audit trail (#34). `AuditService` is exported so the mutating modules
 * (products, stock, orders, purchase orders, users, auth) can write entries
 * inside their own transactions without a circular dependency: this module
 * only depends on the global Prisma module.
 */
@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
