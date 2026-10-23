import { IsInt, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * One order line as sent by the client: only a product reference and a
 * quantity — `unitPrice`/`lineTotal` are server-computed from the product's
 * current price (issue #28), never trusted from the request.
 */
export class OrderItemDto {
  @ApiProperty({
    example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    format: 'uuid',
  })
  @Type(() => String)
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 2, minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  quantity!: number;
}
