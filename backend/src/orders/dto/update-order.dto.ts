import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * PATCH /orders/:id — metadata editing while an order is PENDING (contract §3.7).
 * Items and quantities cannot be modified here to protect stock invariants.
 */
export class UpdateOrderDto {
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
