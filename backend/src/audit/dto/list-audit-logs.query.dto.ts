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

/** Sortable columns on `GET /audit-logs` (contract §3.11). */
export const AUDIT_LOG_SORT_COLUMNS = ['createdAt', 'action'] as const;
export type AuditLogSortBy = (typeof AUDIT_LOG_SORT_COLUMNS)[number];

/**
 * `GET /audit-logs` filters (issue #34). All filters are exact matches;
 * `from`/`to` are inclusive ISO-8601 bounds on `createdAt`.
 */
export class ListAuditLogsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Actor user id' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ example: 'product', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  entityType?: string;

  @ApiPropertyOptional({
    example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  entityId?: string;

  @ApiPropertyOptional({ example: 'product.updated', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @ApiPropertyOptional({ example: '2026-10-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: AUDIT_LOG_SORT_COLUMNS, default: 'createdAt' })
  @IsOptional()
  @IsIn(AUDIT_LOG_SORT_COLUMNS)
  sortBy?: AuditLogSortBy;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
