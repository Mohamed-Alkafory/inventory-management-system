import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination.query.dto.js';

const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED'] as const;

export type OwnOrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * GET /orders/mine query — shared §1 pagination plus an optional status
 * filter. Results are always scoped to the authenticated customer and
 * sorted newest first.
 */
export class ListOwnOrdersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ORDER_STATUSES })
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: OwnOrderStatus;
}
