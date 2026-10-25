import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

import { ReceivePurchaseOrderItemDto } from './receive-item.dto.js';

/**
 * POST /purchase-orders/:id/receive — lines to bring into stock, by
 * `productId` (issue #32 body; the contract's `itemId` flavor is not
 * implemented). Any role can receive; every accepted quantity increases
 * `quantityReceived`, product stock and one `PURCHASE_RECEIPT` movement
 * per line — all inside ONE transaction.
 */
export class ReceivePurchaseOrderDto {
  @ApiProperty({
    type: [ReceivePurchaseOrderItemDto],
    minItems: 1,
    maxItems: 100,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseOrderItemDto)
  items!: ReceivePurchaseOrderItemDto[];
}
