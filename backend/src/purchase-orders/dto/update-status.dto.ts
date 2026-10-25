import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { PurchaseOrderStatus } from '../../generated/prisma/enums.js';

/**
 * PATCH /purchase-orders/:id/status (ADMIN) — the manual lifecycle moves
 * only: DRAFT → ORDERED and DRAFT|ORDERED → CANCELLED. `RECEIVED` and
 * `PARTIALLY_RECEIVED` are never manual targets — they come exclusively
 * from the receive endpoint; anything else (enum-valid but unreachable)
 * answers 409 at the service like every other rejected transition.
 */
export class UpdatePurchaseOrderStatusDto {
  @ApiProperty({
    enum: [PurchaseOrderStatus.ORDERED, PurchaseOrderStatus.CANCELLED],
    example: 'ORDERED',
    description: 'Allowed manual targets — ORDERED or CANCELLED (issue #32).',
  })
  @IsEnum(PurchaseOrderStatus)
  newStatus!: PurchaseOrderStatus;
}
