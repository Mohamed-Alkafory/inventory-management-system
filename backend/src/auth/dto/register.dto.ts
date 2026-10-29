import { IsByteLength, IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/** POST /auth/register — public self-registration. The new account is always CUSTOMER. */
export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  // bcrypt silently truncates at 72 bytes (same rule as LoginDto / CreateUserDto).
  @IsByteLength(8, 72)
  password!: string;
}
