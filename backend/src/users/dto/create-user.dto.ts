import {
  IsByteLength,
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../generated/prisma/enums.js';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  // bcrypt silently truncates at 72 bytes: reject longer passwords here so a
  // stored hash always matches its creator's password exactly.
  @IsByteLength(8, 72)
  password!: string;

  @IsEnum(UserRole)
  role!: UserRole;
}
