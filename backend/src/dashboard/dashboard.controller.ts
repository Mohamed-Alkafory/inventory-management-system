import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import {
  DashboardService,
  type DashboardSummaryResponse,
  type SalesDayResponse,
  type StockMovementDayResponse,
  type TopProductResponse,
} from './dashboard.service.js';
import { DateRangeQueryDto } from './dto/date-range.query.dto.js';
import { TopProductsQueryDto } from './dto/top-products.query.dto.js';
import { PaginationQueryDto } from '../common/dto/pagination.query.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermission } from '../auth/decorators/require-permission.decorator.js';
import { type ProductListResponse } from '../products/products.service.js';

/** JWT role claim resolved by the global JwtAuthGuard. */
interface AuthenticatedUser {
  sub: string;
  role: string;
}

/**
 * Dashboard aggregates (issue #33). ADMIN-only: the payloads expose
 * cost-basis stock value and revenue, which AD-004/AD-009 keep off STAFF
 * screens. Every route accepts an optional inclusive `from`/`to` range
 * (defaults to the last 30 days; at most 92 days — 400 otherwise).
 */
@ApiTags('dashboard')
@ApiBearerAuth()
@RequirePermission('dashboard.read')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Headline dashboard counters (ADMIN)',
    description:
      'Active products, total stock units, stock value on a cost basis (`quantity * costPrice`, AD-009), low-stock and out-of-stock counts, non-cancelled orders in the period and their revenue. Optional `from`/`to` (default: last 30 days; max 92 days).',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Summary payload' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or oversized date range',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'ADMIN only' })
  summary(
    @Query() query: DateRangeQueryDto,
  ): Promise<DashboardSummaryResponse> {
    return this.dashboardService.summary(query);
  }

  @Get('low-stock')
  @ApiOperation({
    summary: 'Products at or below minStock (ADMIN)',
    description:
      'Paginated active products where `quantity <= minStock` — the same query as `GET /stock/low-stock`, exposed for the dashboard page.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated low-stock products',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid pagination',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'ADMIN only' })
  lowStock(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProductListResponse> {
    return this.dashboardService.lowStock(query, user.role);
  }

  @Get('sales')
  @ApiOperation({
    summary: 'Sales per day for a period (ADMIN)',
    description:
      'One entry per UTC day, zero filled; cancelled orders are excluded. Optional `from`/`to` (default: last 30 days; max 92 days).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Zero-filled daily sales series',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or oversized date range',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'ADMIN only' })
  sales(@Query() query: DateRangeQueryDto): Promise<SalesDayResponse[]> {
    return this.dashboardService.sales(query);
  }

  @Get('top-products')
  @ApiOperation({
    summary: 'Best sellers in a period (ADMIN)',
    description:
      'Top `limit` products by units sold (default 5, max 50) among non-cancelled orders in the period. Empty periods return an empty array.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Best-selling products' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid range or limit',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'ADMIN only' })
  topProducts(
    @Query() query: TopProductsQueryDto,
  ): Promise<TopProductResponse[]> {
    return this.dashboardService.topProducts(query);
  }

  @Get('stock-movements')
  @ApiOperation({
    summary: 'Daily movement totals in vs out (ADMIN)',
    description:
      'One entry per UTC day, zero filled; `unitsIn` sums positive movements and `unitsOut` sums absolute negative movements. Optional `from`/`to` (default: last 30 days; max 92 days).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Zero-filled daily movement series',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or oversized date range',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'ADMIN only' })
  stockMovements(
    @Query() query: DateRangeQueryDto,
  ): Promise<StockMovementDayResponse[]> {
    return this.dashboardService.stockMovements(query);
  }
}
