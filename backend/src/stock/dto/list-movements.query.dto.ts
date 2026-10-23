import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination.query.dto.js';
import { StockMovementType } from '../../generated/prisma/enums.js';

/** Every movement type can be filtered; `type` values stay whitelisted. */
const MOVEMENT_TYPES = Object.values(StockMovementType);
export type { StockMovementType };

const SORTABLE_FIELDS = ['createdAt', 'quantityChange', 'type'] as const;
export type MovementSortableField = (typeof SORTABLE_FIELDS)[number];

/**
 * GET /stock/movements — pagination plus filters: `productId`, `type`,
 * `orderId`/`purchaseOrderId` (contract §3.6), a `createdAt` date range
 * (`from`/`to`) and a whitelisted sort.
 */
export class ListMovementsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ enum: MOVEMENT_TYPES })
  @IsOptional()
  @IsIn(MOVEMENT_TYPES)
  type?: StockMovementType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @ApiPropertyOptional({ example: '2026-10-23T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-23T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: SORTABLE_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(SORTABLE_FIELDS)
  sortBy?: MovementSortableField;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
