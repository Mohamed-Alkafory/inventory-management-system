import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { OrderStatus } from '../../generated/prisma/enums.js';

/**
 * PATCH /orders/:id/status — the requested lifecycle status. `PENDING` is a
 * valid enum value that can never be a target (no transition ends in
 * PENDING), so it answers 409 at the service like every other rejected
 * transition; anything outside the enum is a 400 validation error.
 */
export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    example: 'CONFIRMED',
    description: 'Allowed targets — CONFIRMED or CANCELLED (issue #29).',
  })
  @IsEnum(OrderStatus)
  newStatus!: OrderStatus;
}
