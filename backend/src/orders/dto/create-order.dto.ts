import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { OrderItemDto } from './order-item.dto.js';

/**
 * POST /orders — one order with one or more lines. Limits mirror `orders`
 * columns in `prisma/schema.prisma` (customer_name VarChar(100),
 * customer_phone VarChar(20)); notes is TEXT, kept bounded. Stock is
 * deducted and totals are computed inside the service transaction.
 */
export class CreateOrderDto {
  @ApiProperty({
    type: [OrderItemDto],
    minItems: 1,
    maxItems: 100,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ApiPropertyOptional({ example: 'Walk-in customer', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  customerName?: string;

  @ApiPropertyOptional({ example: '+201005551234', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  customerPhone?: string;

  @ApiPropertyOptional({ example: 'Delivery after 5 PM', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
