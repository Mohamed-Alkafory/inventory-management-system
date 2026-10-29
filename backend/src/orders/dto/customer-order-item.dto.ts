import { IsInt, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * One customer order line. Only a product reference and a quantity are
 * accepted — prices, totals, status and ownership are always computed or
 * stamped server-side from the token.
 */
export class CustomerOrderItemDto {
  @ApiProperty({
    example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    format: 'uuid',
  })
  @Type(() => String)
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 50, type: Number })
  @IsInt()
  @Min(1)
  @Max(50)
  quantity!: number;
}
