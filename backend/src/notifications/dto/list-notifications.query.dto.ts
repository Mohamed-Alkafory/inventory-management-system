import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination.query.dto.js';
import { NotificationType } from '../../generated/prisma/enums.js';

/** Every notification type can be filtered; values stay whitelisted. */
const NOTIFICATION_TYPES = Object.values(NotificationType);

const SORTABLE_FIELDS = ['createdAt', 'type'] as const;
export type NotificationSortableField = (typeof SORTABLE_FIELDS)[number];

/** Query strings arrive as strings; convert the two boolean spellings. */
const toBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return value;
};

/**
 * GET /notifications — pagination plus an optional `type`, an `unread`
 * filter (`unread=false` lists only the read ones) and a whitelisted sort.
 * Every row is forced to the current user server-side.
 */
export class ListNotificationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: NOTIFICATION_TYPES })
  @IsOptional()
  @IsIn(NOTIFICATION_TYPES)
  type?: NotificationType;

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  unread?: boolean;

  @ApiPropertyOptional({ enum: SORTABLE_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(SORTABLE_FIELDS)
  sortBy?: NotificationSortableField;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

export { NOTIFICATION_TYPES };
