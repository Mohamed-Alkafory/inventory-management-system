import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination.query.dto.js';

const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED'] as const;
const SORTABLE_FIELDS = ['status', 'createdAt'] as const;
const SORT_ORDERS = ['asc', 'desc'] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type OrderSortableField = (typeof SORTABLE_FIELDS)[number];
export type OrderSortOrder = (typeof SORT_ORDERS)[number];

/**
 * GET /orders query — contract §3.7 list filters plus the shared §1
 * pagination envelope (`page` default 1, `limit` default 20, max 100).
 */
export class ListOrdersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ORDER_STATUSES })
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: OrderStatus;

  @ApiPropertyOptional({
    description: 'Search by order number or customer name (case-insensitive)',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by the user who created the order',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  createdById?: string;

  @ApiPropertyOptional({
    description: 'Inclusive start of the creation date range (ISO 8601)',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Inclusive end of the creation date range (ISO 8601)',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: SORTABLE_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(SORTABLE_FIELDS)
  sortBy?: OrderSortableField;

  @ApiPropertyOptional({ enum: SORT_ORDERS, default: 'desc' })
  @IsOptional()
  @IsIn(SORT_ORDERS)
  sortOrder?: OrderSortOrder;
}
