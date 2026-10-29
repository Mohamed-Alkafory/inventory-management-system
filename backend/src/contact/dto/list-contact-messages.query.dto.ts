import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination.query.dto.js';

const CONTACT_STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED'] as const;

export type ContactStatusFilter = (typeof CONTACT_STATUSES)[number];

/**
 * `GET /contact-messages` — pagination plus the support-inbox filters. Results
 * are always newest first, with an `id` tie-break for deterministic pages.
 */
export class ListContactMessagesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CONTACT_STATUSES })
  @IsOptional()
  @IsIn(CONTACT_STATUSES)
  status?: ContactStatusFilter;

  @ApiPropertyOptional({
    description: 'Only messages assigned to this user',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @ApiPropertyOptional({
    description: 'Search by name, email or subject (case-insensitive)',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
