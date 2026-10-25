import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

/**
 * Optional inclusive date range (`from`/`to`, ISO-8601). Both bounds must
 * be supplied together; when omitted the service defaults to the last 30
 * days. The service also rejects inverted ranges and caps the span at 92
 * days (issue #33).
 */
export class DateRangeQueryDto {
  @ApiPropertyOptional({ example: '2026-09-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-30T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
