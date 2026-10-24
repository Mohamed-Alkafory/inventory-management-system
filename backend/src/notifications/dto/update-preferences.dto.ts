import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  ValidateNested,
} from 'class-validator';

import { NotificationType } from '../../generated/prisma/enums.js';

/**
 * One preference row: whether the current user wants notifications of a
 * given type at all. Missing rows mean the default (`enabled: true`).
 */
export class UpdateNotificationPreferenceDto {
  @ApiProperty({ enum: Object.values(NotificationType) })
  @IsEnum(NotificationType)
  type!: NotificationType;

  @ApiProperty({ example: false })
  @IsBoolean()
  enabled!: boolean;
}

/**
 * PUT /notifications/preferences — a batch of on/off switches for the
 * current user. Unknown types are rejected with 400 by the enum whitelist.
 */
export class UpdatePreferencesDto {
  @ApiProperty({ type: [UpdateNotificationPreferenceDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => UpdateNotificationPreferenceDto)
  preferences!: UpdateNotificationPreferenceDto[];
}
