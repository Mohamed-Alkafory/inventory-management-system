import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination.query.dto.js';

const SORTABLE_FIELDS = ['name', 'sku', 'price', 'quantity', 'createdAt'] as const;
export type ProductSortableField = (typeof SORTABLE_FIELDS)[number];

const STOCK_STATUSES = ['in_stock', 'low_stock', 'out_of_stock'] as const;
export type ProductStockStatus = (typeof STOCK_STATUSES)[number];

/** Query strings arrive as strings; convert the two boolean spellings. */
const toBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return value;
};

/**
 * GET /products — contract §3.4 list query: search, filters, sorting and the
 * §1 pagination envelope.
 *
 * `stockStatus`:
 * - `in_stock`: `quantity > 0`
 * - `low_stock`: `quantity <= minStock` (column comparison → raw SQL path)
 * - `out_of_stock`: `quantity = 0`
 */
export class ListProductsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'pen' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ enum: [true, false] })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: STOCK_STATUSES })
  @IsOptional()
  @IsIn(STOCK_STATUSES)
  stockStatus?: ProductStockStatus;

  @ApiPropertyOptional({ enum: SORTABLE_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(SORTABLE_FIELDS)
  sortBy?: ProductSortableField;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
