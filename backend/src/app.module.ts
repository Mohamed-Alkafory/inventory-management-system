import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';
import { envValidation } from './env.validation.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProductsModule } from './products/products.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { SuppliersModule } from './suppliers/suppliers.module.js';
import { StockModule } from './stock/stock.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { AuditModule } from './audit/audit.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { HealthModule } from './health/health.module.js';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module.js';
import { PermissionsGuard } from './auth/guards/permissions.guard.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { UsersModule } from './users/users.module.js';
import { ContactModule } from './contact/contact.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: envValidation,
      cache: true,
    }),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 100 }] }),
    PrismaModule,
    ProductsModule,
    CategoriesModule,
    CatalogModule,
    SuppliersModule,
    StockModule,
    OrdersModule,
    NotificationsModule,
    PurchaseOrdersModule,
    DashboardModule,
    AuditModule,
    ReportsModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ContactModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: PermissionsGuard },
  ],
})
export class AppModule {}
