import { Controller, Get, HttpStatus, Query, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { type Response } from 'express';

import { ReportsService, type CsvReport } from './reports.service.js';
import {
  ExportInventoryQueryDto,
  ExportMovementsQueryDto,
} from './dto/export.query.dto.js';
import { DateRangeQueryDto } from '../dashboard/dto/date-range.query.dto.js';
import { RequirePermission } from '../auth/decorators/require-permission.decorator.js';

/**
 * CSV exports of the inventory reports (issue #55). ADMIN-only (the inventory
 * export includes cost price — AD-004), authenticated, read-only. Every route
 * answers `text/csv` with an `attachment` filename and reuses the filters of
 * the matching list endpoint.
 */
@ApiTags('reports')
@ApiBearerAuth()
@RequirePermission('reports.read')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('inventory.csv')
  @ApiOperation({
    summary: 'Export the product inventory as CSV (ADMIN)',
    description:
      'Every product matching the `/products` filters (`search`, `categoryId`, `supplierId`, `isActive` default true, `stockStatus`). Columns: SKU, Name, Category, Supplier, Quantity, Min Stock, Price, Cost Price, Active.',
  })
  @ApiProduces('text/csv')
  @ApiResponse({ status: HttpStatus.OK, description: 'CSV attachment' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid filter',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'ADMIN only' })
  async inventory(
    @Query() query: ExportInventoryQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    return send(await this.reportsService.inventory(query), res);
  }

  @Get('low-stock.csv')
  @ApiOperation({
    summary: 'Export low-stock products as CSV (ADMIN)',
    description:
      'Active products with `quantity <= minStock`. Columns: SKU, Name, Category, Supplier, Quantity, Min Stock, Shortfall.',
  })
  @ApiProduces('text/csv')
  @ApiResponse({ status: HttpStatus.OK, description: 'CSV attachment' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'ADMIN only' })
  async lowStock(@Res({ passthrough: true }) res: Response): Promise<string> {
    return send(await this.reportsService.lowStock(), res);
  }

  @Get('sales.csv')
  @ApiOperation({
    summary: 'Export sales as CSV (ADMIN)',
    description:
      'One row per non-cancelled order in the period. Optional `from`/`to` (both or neither; default last 30 days; at most 92 days). Columns: Order Number, Created At, Status, Customer, Phone, Items, Total, Created By.',
  })
  @ApiProduces('text/csv')
  @ApiResponse({ status: HttpStatus.OK, description: 'CSV attachment' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or oversized date range',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'ADMIN only' })
  async sales(
    @Query() query: DateRangeQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    return send(await this.reportsService.sales(query), res);
  }

  @Get('stock-movements.csv')
  @ApiOperation({
    summary: 'Export the stock movement history as CSV (ADMIN)',
    description:
      'Filters: `productId`, `type`, `orderId`, `purchaseOrderId`, inclusive `from`/`to`. Columns: Created At, SKU, Product, Type, Change, Quantity After, Reason, Order Number, Purchase Order Number, Created By.',
  })
  @ApiProduces('text/csv')
  @ApiResponse({ status: HttpStatus.OK, description: 'CSV attachment' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid filter',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'ADMIN only' })
  async stockMovements(
    @Query() query: ExportMovementsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    return send(await this.reportsService.stockMovements(query), res);
  }
}

/** Attach the download headers and hand the body back to Nest. */
function send(report: CsvReport, res: Response): string {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${report.filename}"`,
  );
  return report.content;
}
