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
import { Throttle } from '@nestjs/throttler';

import {
  OrdersService,
  type CreatedOrderResponse,
  type CustomerOrderListResponse,
  type CustomerOrderResponse,
  type OrderDetailResponse,
  type OrderListResponse,
  type OrderResponse,
} from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { CreateOwnOrderDto } from './dto/create-own-order.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { ListOrdersQueryDto } from './dto/list-orders.query.dto.js';
import { ListOwnOrdersQueryDto } from './dto/list-own-orders.query.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermission } from '../auth/decorators/require-permission.decorator.js';

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
  @RequirePermission('orders.create')
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
  @RequirePermission('orders.update_status')
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
  @RequirePermission('orders.read_all')
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
   * POST /orders/mine — a CUSTOMER places their own order. The shared
   * service transaction is reused. The body can never carry price, status,
   * customerId or createdById (unknown fields are rejected by the global
   * ValidationPipe).
   */
  @Post('mine')
  @RequirePermission('orders.create_own')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Create my order (CUSTOMER only)',
    description:
      'Accepts 1–30 distinct products with quantity 1–50 each plus the shipping details. Only active products are allowed. Prices, line totals, the total, status, customerId and createdById are stamped server-side from the token — the client can never send them. Reuses the same Serializable creation transaction as the staff till (server-side pricing, atomic stock decrement, SALE movements, audit and admin notification). Throttled to 10 requests per minute.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      'Order created; customer-safe payload (id, orderNumber, status, totalAmount, items, shipping fields, paymentMethod, createdAt, cancelledAt)',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Validation failed (field errors, >30 items, quantity outside 1–50, duplicate productId, client-sent price/status/customerId/createdById)',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Authenticated but not a CUSTOMER (missing orders.create_own)',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product does not exist',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Insufficient stock or orderNumber conflict (retried internally)',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Product is inactive',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'More than 10 customer order attempts per minute',
  })
  createMine(
    @Body() dto: CreateOwnOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CustomerOrderResponse> {
    return this.ordersService.createMine(dto, user.sub, user.role);
  }

  /**
   * GET /orders/mine — paginated own orders, newest first. Must be declared
   * before `GET /orders/:id` so `mine` is never parsed as an id.
   */
  @Get('mine')
  @RequirePermission('orders.read_own')
  @ApiOperation({
    summary: 'List my orders (CUSTOMER only)',
    description:
      'Paginated list of the authenticated customer’s own orders, newest first, optionally filtered by status. Never returns another customer’s orders or internal fields.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated customer-safe order list',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failed (pagination or status filter)',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Authenticated but not a CUSTOMER (missing orders.read_own)',
  })
  findMine(
    @Query() query: ListOwnOrdersQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CustomerOrderListResponse> {
    return this.ordersService.findMine(query, user.sub);
  }

  /**
   * GET /orders/mine/:id — one own order. Unknown ids and other customers'
   * orders both answer 404 (never 403) so ownership cannot be probed.
   */
  @Get('mine/:id')
  @RequirePermission('orders.read_own')
  @ApiOperation({
    summary: 'Get one of my orders (CUSTOMER only)',
    description:
      'Returns the customer-safe representation of an order owned by the caller. A non-existent order and an order owned by somebody else both answer 404.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer-safe order details',
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
    status: HttpStatus.FORBIDDEN,
    description: 'Authenticated but not a CUSTOMER (missing orders.read_own)',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Order does not exist or belongs to another customer',
  })
  findMineOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CustomerOrderResponse> {
    return this.ordersService.findMineOne(id, user.sub);
  }

  /**
   * POST /orders/mine/:id/cancel — cancel an own PENDING order. Reuses the
   * staff cancellation transaction (stock restored with RETURN movements);
   * a double cancel is a 409 and never restores stock twice.
   */
  @Post('mine/:id/cancel')
  @RequirePermission('orders.cancel_own')
  @ApiOperation({
    summary: 'Cancel my PENDING order (CUSTOMER only)',
    description:
      'Allowed only while the order is PENDING and owned by the caller. Cancellation restores every line’s stock with RETURN movements and stamps cancelledAt in the same Serializable transaction as the staff cancel. A second cancel answers 409 and never restores stock twice. Unknown or foreign orders answer 404.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Order cancelled; customer-safe payload with cancelledAt',
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
    status: HttpStatus.FORBIDDEN,
    description: 'Authenticated but not a CUSTOMER (missing orders.cancel_own)',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Order does not exist or belongs to another customer',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Order is not PENDING (already confirmed or cancelled)',
  })
  cancelMine(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CustomerOrderResponse> {
    return this.ordersService.cancelMine(id, user.sub, user.role);
  }

  /**
   * GET /orders/:id — order details with items snapshots, createdBy, and stock movements.
   */
  @Get(':id')
  @RequirePermission('orders.read_all')
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
  @RequirePermission('orders.update')
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
