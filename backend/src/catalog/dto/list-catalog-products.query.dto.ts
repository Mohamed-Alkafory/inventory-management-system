import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { CatalogPaginationQueryDto } from './catalog-pagination.query.dto.js';

export const CATALOG_SORT_FIELDS = ['name', 'price', 'newest'] as const;
export type CatalogSortField = (typeof CATALOG_SORT_FIELDS)[number];

/**
 * GET /catalog/products — public search, category filter, sorting and the §1
 * pagination envelope. `newest` maps to `Product.createdAt`; the id tie-break
 * is always ascending so equal values keep a stable order.
 */
export class ListCatalogProductsQueryDto extends CatalogPaginationQueryDto {
  @ApiPropertyOptional({ example: 'pen' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: CATALOG_SORT_FIELDS, default: 'newest' })
  @IsOptional()
  @IsIn(CATALOG_SORT_FIELDS)
  sort: CatalogSortField = 'newest';

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    description:
      'Defaults to `desc` for `newest` and `asc` for `name`/`price`.',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
