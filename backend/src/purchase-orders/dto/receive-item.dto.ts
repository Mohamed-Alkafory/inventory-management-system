import { IsInt, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * One line to receive for a purchase order. Full or partial receiving
 * works per product line; receiving more than the ordered amount minus
 * what is already received answers 409 (issue #32).
 */
export class ReceivePurchaseOrderItemDto {
  @ApiProperty({
    example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    format: 'uuid',
  })
  @Type(() => String)
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 20, minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  quantity!: number;
}
