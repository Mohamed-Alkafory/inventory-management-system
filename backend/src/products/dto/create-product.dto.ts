import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * POST /products (ADMIN only).
 * Length/range limits mirror `products` columns in `prisma/schema.prisma`
 * (VarChar(64)/(200)/(100), Decimal(12,2) → max 9999999999.99).
 */
export class CreateProductDto {
  @ApiProperty({ example: 'OFF-PEN-002', minLength: 1, maxLength: 64 })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  sku!: string;

  @ApiProperty({ example: 'Ballpoint Pen', minLength: 1, maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'Blue ink, 0.7 mm', maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description!: string;

  @ApiPropertyOptional({ example: 'https://example.com/pen.png', maxLength: 2048 })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl!: string;

  @ApiPropertyOptional({ example: '8901234567890', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  barcode!: string;

  @ApiProperty({ example: 19.99, minimum: 0, maximum: 9999999999.99 })
  @IsNumber()
  @Min(0)
  @Max(9999999999.99)
  price!: number;

  @ApiPropertyOptional({ example: 9.5, minimum: 0, maximum: 9999999999.99 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9999999999.99)
  costPrice!: number;

  @ApiPropertyOptional({ example: 500, minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity!: number;

  @ApiPropertyOptional({ example: 50, minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minStock!: number;

  @ApiProperty({ example: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' })
  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional({
    example: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  supplierId?: string | null;
}
