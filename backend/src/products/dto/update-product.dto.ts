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
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * PATCH /products/:id (ADMIN only) — every editable field optional.
 *
 * Not updatable here, on purpose:
 * - `quantity`: only the stock service writes product quantities (AD-005; the
 *   stock is changed via `/stock/adjustments` and purchase receipts).
 * - `isActive`: deactivation goes through DELETE /products/:id (AD-001).
 */
export class UpdateProductDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 64 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  sku!: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description!: string | null;

  @ApiPropertyOptional({ maxLength: 2048 })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl!: string | null;

  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  barcode!: string | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 9999999999.99 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9999999999.99)
  price!: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 9999999999.99 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9999999999.99)
  costPrice!: number | null;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minStock!: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  supplierId!: string | null;
}
