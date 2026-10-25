import { IsInt, IsNumber, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * One purchase-order line as sent by the client. `unitCost` IS client
 * input (what the supplier charges — contract §3.8), but the line total
 * and the order total are always recomputed server-side with decimal
 * math; `quantityReceived` starts at 0 and is only ever moved by the
 * receive endpoint.
 */
export class PurchaseOrderItemDto {
  @ApiProperty({
    example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    format: 'uuid',
  })
  @Type(() => String)
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 50, minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  quantityOrdered!: number;

  @ApiProperty({ example: 0.6, minimum: 0, type: Number })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'unitCost must have at most 2 decimal places' },
  )
  @Min(0)
  @Max(9999999999)
  unitCost!: number;
}
