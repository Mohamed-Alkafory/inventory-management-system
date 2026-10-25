import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { DateRangeQueryDto } from './date-range.query.dto.js';

/** GET /dashboard/top-products — a date range plus a capped `limit`. */
export class TopProductsQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 50, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
