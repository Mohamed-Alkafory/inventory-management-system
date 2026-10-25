import { Type } from 'class-transformer';
import {
  IsByteLength,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** New password supplied with `PATCH /auth/me` (`password: { current, next }`). */
export class ProfilePasswordDto {
  @IsString()
  @MinLength(8)
  @IsByteLength(8, 72)
  current!: string;

  @IsString()
  @MinLength(8)
  // bcrypt truncates after 72 bytes; reject longer inputs so the stored hash
  // always matches the password the user actually chose.
  @IsByteLength(8, 72)
  next!: string;
}

/**
 * `PATCH /auth/me` — only the fields a user may change on their own profile
 * are accepted: `name` and (nested) `password`. Anything else is rejected by
 * the global `forbidNonWhitelisted` pipe (400), so `role`, `email` and
 * `isActive` remain ADMIN-managed.
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProfilePasswordDto)
  password?: ProfilePasswordDto;
}
