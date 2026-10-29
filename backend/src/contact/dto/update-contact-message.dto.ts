import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { ContactStatus } from '../../generated/prisma/enums.js';

/**
 * `PATCH /contact-messages/:id` — triage fields only. `assignedToId` and
 * `internalNote` accept `null` to unassign / clear; the assignee must be an
 * active SUPPORT or ADMIN user (checked by the service).
 */
export class UpdateContactMessageDto {
  @ApiPropertyOptional({ enum: ContactStatus })
  @IsOptional()
  @IsEnum(ContactStatus)
  status?: ContactStatus;

  @ApiPropertyOptional({
    description:
      'Active SUPPORT or ADMIN user id, or null to unassign. Unknown or ineligible ids answer 404.',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  assignedToId?: string | null;

  @ApiPropertyOptional({
    description: 'Internal support note, or null to clear',
    maxLength: 5000,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  internalNote?: string | null;
}
