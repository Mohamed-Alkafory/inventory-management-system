import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PurchaseOrderItemDto } from './po-item.dto.js';

/**
 * POST /purchase-orders (ADMIN) — a DRAFT purchase order for one supplier
 * with one or more product lines. `totalAmount` and per-line totals are
 * computed server-side with decimal math; `orderNumber` is generated
 * server-side (e.g. PO-0001). Created orders always start in `DRAFT`.
 */
export class CreatePurchaseOrderDto {
  @ApiProperty({
    example: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    format: 'uuid',
  })
  @Type(() => String)
  @IsUUID()
  supplierId!: string;

  @ApiProperty({
    type: [PurchaseOrderItemDto],
    minItems: 1,
    maxItems: 100,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items!: PurchaseOrderItemDto[];

  @ApiPropertyOptional({ example: '2026-11-15T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expectedAt?: string;

  @ApiPropertyOptional({ example: 'Restock for November', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  notes?: string;
}
