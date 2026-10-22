import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/**
 * Shared pagination query params (contract §1: `page` default 1, `limit`
 * default 20, max 100). Base class for list-endpoint query DTOs.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100, type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
