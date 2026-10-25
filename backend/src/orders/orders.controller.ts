import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import {
  OrdersService,
  type CreatedOrderResponse,
  type OrderDetailResponse,
  type OrderListResponse,
  type OrderResponse,
} from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { ListOrdersQueryDto } from './dto/list-orders.query.dto.js';
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

  /**
   * PATCH /orders/:id/status (issue #29) — PENDING → CONFIRMED,
   * PENDING → CANCELLED, CONFIRMED → CANCELLED; every other combination
   * (including touching a cancelled order) is 409. Cancelling restores
   * each item's stock with `RETURN` movements in the same transaction, so
   * cancelling twice can never restore stock twice.
   */
  @Patch(':id/status')
  @ApiOperation({
    summary: 'Change order status (STAFF and ADMIN)',
    description:
      'Allowed transitions: PENDING → CONFIRMED, PENDING → CANCELLED, CONFIRMED → CANCELLED. All others — including re-confirming, un-cancelling, or the same status — answer 409, and a cancelled order is terminal. Cancellation restores stock for every line (one RETURN movement per line) and stamps cancelledAt inside ONE transaction; cancelling twice is a 409 and never restores stock twice.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Updated order with its item snapshots',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Validation failed (malformed id or a status outside the OrderStatus enum)',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Order does not exist',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Invalid transition (or the status changed concurrently)',
  })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreatedOrderResponse> {
    return this.ordersService.updateStatus(id, dto, user.sub, user.role);
  }

  /**
   * GET /orders — list orders with pagination and filters (contract §3.7).
   */
  @Get()
  @ApiOperation({
    summary: 'List orders (STAFF and ADMIN)',
    description:
      'Paginated list of orders filterable by status, createdById, search (orderNumber or customerName), and creation date range (from/to).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated order list with pagination metadata',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Validation failed (e.g. invalid query params, date range inverted)',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  findAll(@Query() query: ListOrdersQueryDto): Promise<OrderListResponse> {
    return this.ordersService.findAll(query);
  }

  /**
   * GET /orders/:id — order details with items snapshots, createdBy, and stock movements.
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get order by id (STAFF and ADMIN)',
    description:
      'Returns the order fields plus items snapshots, createdBy user info, and related stock movements.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detailed order representation',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid UUID format',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Order does not exist',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrderDetailResponse> {
    return this.ordersService.findOne(id);
  }

  /**
   * PATCH /orders/:id — edit order metadata while in PENDING status (contract §3.7).
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update order metadata (STAFF and ADMIN)',
    description:
      'Update customerName, customerPhone, or notes while order is PENDING. An order in CONFIRMED or CANCELLED status answers 422.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Updated order record',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failed (malformed id or payload)',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Order does not exist',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Order is not in PENDING status',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrderResponse> {
    return this.ordersService.update(id, dto, user.sub);
  }
}
