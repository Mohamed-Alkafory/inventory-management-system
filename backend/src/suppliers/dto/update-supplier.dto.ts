import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * PATCH /suppliers/:id (ADMIN only) — every editable field optional; contact
 * fields accept `null` to clear them. `isActive: false` is the soft delete
 * surface (AD-001) and is additionally served by DELETE /suppliers/:id.
 */
export class UpdateSupplierDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  companyName!: string;

  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email!: string | null;

  @ApiPropertyOptional({ minLength: 1, maxLength: 20, nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  phone!: string | null;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  address!: string | null;

  @ApiPropertyOptional({ enum: [true, false] })
  @IsOptional()
  @IsBoolean()
  isActive!: boolean;
}
