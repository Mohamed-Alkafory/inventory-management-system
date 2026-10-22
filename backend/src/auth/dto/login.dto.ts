import { IsByteLength, IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto{
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  // bcrypt silently truncates at 72 bytes: an upper byte bound stops a longer
  // password from authenticating against a hash of its first 72 bytes.
  @IsByteLength(0, 72)
  password!: string;
}
