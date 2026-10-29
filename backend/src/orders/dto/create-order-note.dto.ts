import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * POST /orders/:id/notes — internal support note. Trimmed, 1–2000 chars.
 * These notes are staff-only and never appear in any customer response.
 */
export class CreateOrderNoteDto {
  @ApiProperty({ example: 'Customer called about the delivery date.', maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  note!: string;
}
