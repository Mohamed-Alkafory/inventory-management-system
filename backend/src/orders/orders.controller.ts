import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { OrdersService, type CreatedOrderResponse } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

/** JWT role claim resolved from the database by the global JwtAuthGuard. */
interface AuthenticatedUser {
  sub: string;
  role: string;
}

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * POST /orders — any authenticated role (STAFF runs the till). Totals and
   * stock are computed server-side in ONE Serializable transaction: a
   * failure on any line (409 insufficient stock, 404 missing, 422 inactive)
   * rolls the whole order back. `createdById` comes from the token.
   */
  @Post()
  @ApiOperation({
    summary: 'Create an order (STAFF and ADMIN)',
    description:
      'Accepts 1–100 order lines { productId, quantity }. Prices, line totals and the total are computed server-side — client-sent prices are never trusted. Stock is deducted with one SALE movement per line; insufficient stock answers 409 and rolls the whole order back. Missing (404) and inactive (422) products are rejected. A readable sequential orderNumber (e.g. ORD-0001) is generated server-side.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Order created with its item snapshots',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failed (field errors, duplicate productId...)',
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
    description:
      'Insufficient stock or orderNumber conflict (retried internally)',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Product is inactive',
  })
  create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreatedOrderResponse> {
    return this.ordersService.create(dto, user.sub, user.role);
  }
}
