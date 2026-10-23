import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * POST /suppliers (ADMIN only). Length limits mirror `suppliers` columns in
 * `prisma/schema.prisma` (company_name VarChar(200), email VarChar(255),
 * phone VarChar(20); address is TEXT — kept bounded like the other
 * description-style fields).
 */
export class CreateSupplierDto {
  @ApiProperty({ example: 'Office Plus Ltd.', minLength: 1, maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  companyName!: string;

  @ApiPropertyOptional({ example: 'sales@officeplus.com', maxLength: 255 })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiPropertyOptional({
    example: '+201005551234',
    minLength: 1,
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  phone!: string;

  @ApiPropertyOptional({ example: '12 Nasr Street, Cairo', maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  address!: string;
}
