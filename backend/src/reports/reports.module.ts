import { Module } from '@nestjs/common';

import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

/**
 * CSV report exports (#55). Read-only; reuses the Prisma module (global) and
 * the dashboard's validated date-range helper. ADMIN-only at the controller.
 */
@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
