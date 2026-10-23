import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * POST /categories (ADMIN only). Length limits mirror `categories` columns in
 * `prisma/schema.prisma` (name VarChar(100) with a unique index; description
 * TEXT — kept bounded like the other description fields).
 */
export class CreateCategoryDto {
  @ApiProperty({ example: 'Electronics', minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    example: 'Devices and accessories',
    maxLength: 5000,
    default: null,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description!: string;
}
