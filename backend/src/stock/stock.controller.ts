import { Body, Controller, Get, HttpStatus, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import {
  StockService,
  type AdjustedStockResponse,
  type MovementListResponse,
} from './stock.service.js';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto.js';
import { ListMovementsQueryDto } from './dto/list-movements.query.dto.js';
import type { ProductListResponse } from '../products/products.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermission } from '../auth/decorators/require-permission.decorator.js';

/** JWT role claim resolved from the database by the global JwtAuthGuard. */
interface AuthenticatedUser {
  sub: string;
  role: string;
}

@ApiTags('stock')
@ApiBearerAuth()
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('movements')
  @RequirePermission('stock.read')
  @ApiOperation({
    summary: 'List stock movements (filters, date range, sorting, pagination)',
    description:
      'Returns the contract §1 pagination envelope. Filters: `productId`, `type` (PURCHASE_RECEIPT/SALE/RETURN/ADJUSTMENT), `orderId`, `purchaseOrderId`, `from`/`to` createdAt range.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated movement list',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid query parameter',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  findAll(
    @Query() query: ListMovementsQueryDto,
  ): Promise<MovementListResponse> {
    return this.stockService.findAll(query);
  }

  @Post('adjustments')
  @RequirePermission('stock.adjust')
  @ApiOperation({
    summary: 'Adjust a product quantity (STAFF and ADMIN)',
    description:
      'quantityChange is a signed non-zero integer; `reason` is required. Quantity and the ADJUSTMENT movement are written in ONE Serializable transaction, computed server-side. 409 when the quantity would drop below zero; 422 when the product is inactive.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Adjustment applied — { movement, product }',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product does not exist',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'The quantity would go below zero',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Product is inactive',
  })
  adjust(
    @Body() dto: CreateAdjustmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdjustedStockResponse> {
    return this.stockService.adjust(dto, user.sub, user.role);
  }

  @Get('low-stock')
  @RequirePermission('stock.read')
  @ApiOperation({
    summary: 'List low-stock products',
    description:
      'Paginated active products with `quantity <= minStock`. Only `page`/`limit` are accepted; `costPrice` is included for ADMIN only (AD-004).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated low-stock product list',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid query parameter',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  lowStock(
    @Query() query: ListMovementsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProductListResponse> {
    return this.stockService.lowStock(query, user.role);
  }
}
