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

import { CustomerOrderItemDto } from './customer-order-item.dto.js';

/**
 * POST /orders/mine — a customer places their own order. The body can never
 * carry `price`, `status`, `customerId` or `createdById`: those fields are
 * not declared here and the global ValidationPipe rejects unknown properties.
 *
 * Limits mirror the issue: 1–30 distinct products, 1–50 per line. Lengths
 * mirror the matching `orders` columns in `prisma/schema.prisma`.
 */
export class CreateOwnOrderDto {
  @ApiProperty({
    type: [CustomerOrderItemDto],
    minItems: 1,
    maxItems: 30,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CustomerOrderItemDto)
  items!: CustomerOrderItemDto[];

  @ApiProperty({ example: 'Jane Doe', maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  recipientName!: string;

  @ApiProperty({ example: '+201005551234', maxLength: 20 })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  recipientPhone!: string;

  @ApiProperty({ example: '12 Nile Street, Apt 4', maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  shippingAddress!: string;

  @ApiProperty({ example: 'Cairo', maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  shippingCity!: string;

  @ApiPropertyOptional({ example: 'Please call on arrival', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
