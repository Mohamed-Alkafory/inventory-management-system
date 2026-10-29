import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { UserRole } from '../../generated/prisma/enums.js';

const SORTABLE_FIELDS = ['name', 'email', 'role', 'isActive', 'createdAt', 'updatedAt'] as const;
export type UserSortableField = (typeof SORTABLE_FIELDS)[number];

/** GET /users — contract §3.2 pagination envelope (`page`/`limit`/`search`/`role`/`sortBy`/`sortOrder`). */
export class ListUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsIn(SORTABLE_FIELDS)
  sortBy?: UserSortableField;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
