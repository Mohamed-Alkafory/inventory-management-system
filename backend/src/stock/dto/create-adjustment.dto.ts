import {
  IsInt,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  NotEquals,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * POST /stock/adjustments (STAFF and ADMIN — the global guard chain only
 * requires an authenticated user).
 *
 * `quantityChange` must be a non-zero integer: positive (stock in) or
 * negative (stock out). `0` is rejected with 400 — a neutral adjustment
 * would only add noise to the movement history. The reason is required for
 * the audit trail and bounded like other free-text fields.
 */
export class CreateAdjustmentDto {
  @ApiProperty({
    example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    format: 'uuid',
  })
  @Type(() => String)
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: -5, type: Number })
  @IsInt()
  @NotEquals(0)
  quantityChange!: number;

  @ApiProperty({
    example: 'Damaged items removed from shelf',
    minLength: 1,
    maxLength: 500,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
