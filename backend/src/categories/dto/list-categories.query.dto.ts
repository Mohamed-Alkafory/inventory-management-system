import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination.query.dto.js';

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
 * GET /categories — contract §3.3 list query: search, `isActive` filter and
 * the §1 pagination envelope (defaults: `page` 1, `limit` 20).
 */
export class ListCategoriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'elect' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: [true, false], default: true })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;
}
