import {
  Body,
  Controller,
  Get,
  HttpCode,
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
  PurchaseOrdersService,
  type PurchaseOrderDetailResponse,
  type PurchaseOrderListResponse,
} from './purchase-orders.service.js';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto.js';
import { UpdatePurchaseOrderStatusDto } from './dto/update-status.dto.js';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto.js';
import { ListPurchaseOrdersQueryDto } from './dto/list-purchase-orders.query.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermission } from '../auth/decorators/require-permission.decorator.js';

/** JWT claim of the signed-in user (resolved by the global JwtAuthGuard). */
interface AuthenticatedUser {
  sub: string;
  role: string;
}

@ApiTags('purchase-orders')
@ApiBearerAuth()
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  /**
   * GET /purchase-orders — any authenticated role, paginated with `status`
   * and `supplierId` filters.
   */
  @Get()
  @RequirePermission('po.read')
  @ApiOperation({
    summary: 'List purchase orders (STAFF and ADMIN)',
    description:
      'Pagination + filters `status`, `supplierId`; whitelisted sort (createdAt | status).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated purchase orders',
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
    @Query() query: ListPurchaseOrdersQueryDto,
  ): Promise<PurchaseOrderListResponse> {
    return this.purchaseOrdersService.findAll(query);
  }

  /** GET /purchase-orders/:id — any authenticated role, detail + items. */
  @Get(':id')
  @RequirePermission('po.read')
  @ApiOperation({
    summary: 'Get one purchase order with its items and supplier',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Purchase order detail',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Malformed id',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Purchase order does not exist',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PurchaseOrderDetailResponse> {
    return this.purchaseOrdersService.findOne(id);
  }

  /**
   * POST /purchase-orders (ADMIN, issue #32) — a DRAFT purchase order.
   * Supplier and every product line are validated, a sequential PO number
   * is generated and totals are computed server-side in ONE Serializable
   * transaction. No stock changes until receiving.
   */
  @Post()
  @RequirePermission('po.create')
  @ApiOperation({
    summary: 'Create a purchase order (ADMIN)',
    description:
      'Validates supplier (404 missing, 422 inactive) and every product line (404 missing, 422 inactive); duplicate productId is 400. The sequential orderNumber (e.g. PO-0001) and decimal-computed totals are generated server-side; created orders always start in DRAFT and touch NO stock.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Purchase order created with its items (status DRAFT)',
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
    status: HttpStatus.FORBIDDEN,
    description: 'Only ADMIN may create purchase orders',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Supplier or product does not exist',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'orderNumber conflict (retried internally)',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Supplier or product is inactive',
  })
  create(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PurchaseOrderDetailResponse> {
    return this.purchaseOrdersService.create(dto, user.sub);
  }

  /**
   * PATCH /purchase-orders/:id/status (ADMIN, issue #32) — manual moves
   * only: DRAFT → ORDERED and DRAFT|ORDERED → CANCELLED. PARTIALLY_RECEIVED
   * and RECEIVED are never manual targets (they come from /receive); every
   * rejected transition (including touching terminal states) is 409.
   */
  @Patch(':id/status')
  @RequirePermission('po.update_status')
  @ApiOperation({
    summary: 'Change purchase order status (ADMIN)',
    description:
      'Allowed manual transitions: DRAFT → ORDERED, DRAFT → CANCELLED, ORDERED → CANCELLED. Everything else — including RECEIVED/PARTIALLY_RECEIVED targets (only receiving moves a PO there) and cancelled orders — answers 409. Cancelling touches no stock.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Updated purchase order with its items',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Validation failed (malformed id or a status outside the PurchaseOrderStatus enum)',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Only ADMIN may change purchase order status',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Purchase order does not exist',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Invalid transition (or the status changed concurrently)',
  })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseOrderStatusDto,
  ): Promise<PurchaseOrderDetailResponse> {
    return this.purchaseOrdersService.updateStatus(id, dto);
  }

  /**
   * POST /purchase-orders/:id/receive (issue #32) — any authenticated
   * role. Receiving more than the remaining quantity is 409; DRAFT,
   * CANCELLED and already RECEIVED orders are rejected. Stock, movements,
   * `quantityReceived`, status and `receivedAt` all change in ONE
   * transaction; a failure leaves no partial data.
   */
  @Post(':id/receive')
  @RequirePermission('po.receive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive purchase order lines into stock (STAFF and ADMIN)',
    description:
      'Full or partial receiving per line: { items: [{ productId, quantity }] }. Increments quantityReceived, raises product stock with one PURCHASE_RECEIPT movement per line and moves the status to PARTIALLY_RECEIVED or RECEIVED (receivedAt on full receipt) — ONE transaction, all-or-nothing. Over-receiving answers 409; DRAFT/CANCELLED/RECEIVED orders answer 409; products not on the order answer 400.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Updated purchase order with its items',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Validation failed (malformed id, duplicate productId, product not on the order)',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Purchase order does not exist',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'Over-receive, or the order is DRAFT/CANCELLED/RECEIVED, or a concurrent change',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Product is inactive (raised by the shared stock write)',
  })
  receive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceivePurchaseOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PurchaseOrderDetailResponse> {
    return this.purchaseOrdersService.receive(id, dto, user.sub, user.role);
  }
}
