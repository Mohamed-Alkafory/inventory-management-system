import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination.query.dto.js';
import { PurchaseOrderStatus } from '../../generated/prisma/enums.js';

const ALL_STATUSES = Object.values(PurchaseOrderStatus);

const SORTABLE_FIELDS = ['createdAt', 'status'] as const;
export type PurchaseOrderSortableField = (typeof SORTABLE_FIELDS)[number];

/**
 * GET /purchase-orders — pagination plus `status` and `supplierId`
 * filters and a whitelisted sort.
 */
export class ListPurchaseOrdersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ALL_STATUSES })
  @IsOptional()
  @IsIn(ALL_STATUSES)
  status?: PurchaseOrderStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ enum: SORTABLE_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(SORTABLE_FIELDS)
  sortBy?: PurchaseOrderSortableField;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
