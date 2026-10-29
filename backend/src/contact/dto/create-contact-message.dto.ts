import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Public `POST /contact` body. Every text field is trimmed before validation,
 * and the lengths mirror the matching `contact_messages` columns. `honeypot`
 * is an optional anti-bot field: when a bot fills it in, the request still
 * answers 201 but nothing is persisted.
 */
export class CreateContactMessageDto {
  @ApiProperty({ example: 'Jane Doe', maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'jane@example.com', maxLength: 255 })
  @Transform(trim)
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'Question about my order', maxLength: 200 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject!: string;

  @ApiProperty({ example: 'Hello, I need help with...', maxLength: 5000 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message!: string;

  @ApiPropertyOptional({
    description:
      'Honeypot field. Leave empty; a non-empty value is silently discarded.',
    maxLength: 255,
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  honeypot?: string;
}
