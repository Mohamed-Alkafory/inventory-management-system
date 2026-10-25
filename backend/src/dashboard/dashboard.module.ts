import { Module } from '@nestjs/common';

import { StockModule } from '../stock/stock.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

/**
 * Dashboard aggregates (#33), ADMIN-only. Reuses the stock module's
 * low-stock query (shared with `GET /stock/low-stock`) and PrismaService
 * (global) for the period aggregates; column-math figures go through
 * parameterized raw SQL.
 */
@Module({
  imports: [StockModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
