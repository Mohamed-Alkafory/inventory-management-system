import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * PATCH /categories/:id (ADMIN only) — every editable field optional.
 *
 * `isActive: false` is also how the identity of a soft delete is expressed
 * (AD-001); deactivation is additionally served by DELETE /categories/:id.
 */
export class UpdateCategoryDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description!: string | null;

  @ApiPropertyOptional({ enum: [true, false] })
  @IsOptional()
  @IsBoolean()
  isActive!: boolean;
}
