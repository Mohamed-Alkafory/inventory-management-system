import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { StockService, type MovementListResponse } from './stock.service.js';
import { ListMovementsQueryDto } from './dto/list-movements.query.dto.js';

/**
 * `GET /products/:id/movements` — one product's stock history. Sits on the
 * products path but belongs to the stock domain; `/products/:id` (2
 * segments) never matches this 3-segment route.
 */
@ApiTags('stock')
@ApiBearerAuth()
@Controller('products')
export class ProductMovementsController {
  constructor(private readonly stockService: StockService) {}

  @Get(':id/movements')
  @ApiOperation({
    summary: "List a product's stock movements",
    description:
      'Same filters, date range and pagination as GET /stock/movements, forced to the path product. History stays readable for soft-deleted products (AD-001).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated movement list for the product',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid query parameter or id',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product does not exist',
  })
  findAll(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListMovementsQueryDto,
  ): Promise<MovementListResponse> {
    return this.stockService.findForProduct(id, query);
  }
}
