import { IsByteLength, IsString, MinLength } from 'class-validator';

/** `POST /auth/change-password` — verifies the current password first. */
export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  @IsByteLength(8, 72)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @IsByteLength(8, 72)
  newPassword!: string;
}
