import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../auth/decorators/public.decorator.js';
import {
  ContactService,
  type ContactSubmissionResponse,
} from './contact.service.js';
import { CreateContactMessageDto } from './dto/create-contact-message.dto.js';

/**
 * Public contact form abuse limit. The global private API allows 100 requests
 * per minute; anonymous submissions are capped at 5 per hour per client.
 */
export const CONTACT_THROTTLE_LIMIT = 5;
export const CONTACT_THROTTLE_TTL_MS = 60 * 60 * 1000;

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Public()
  @Throttle({
    default: {
      limit: CONTACT_THROTTLE_LIMIT,
      ttl: CONTACT_THROTTLE_TTL_MS,
    },
  })
  @Post()
  @ApiOperation({
    summary: 'Send a contact message (public)',
    description:
      'No authentication required. Name (max 100), email (valid, max 255), subject (max 200) and message (max 5000) are trimmed and validated; the body may not carry any other field. The optional `honeypot` field is a spam trap: when non-empty the request still answers 201 but nothing is stored. A real submission sends a best-effort `CONTACT_MESSAGE_RECEIVED` notification to active SUPPORT users after insert. Throttled to 5 requests per hour per client. The response is only `{ received: true }` — no message id, assignee or internal note.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Message accepted (or silently discarded by the honeypot)',
    schema: { example: { received: true } },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Validation failed (missing/oversized fields, invalid email, unknown field)',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'More than 5 contact submissions per hour',
  })
  create(
    @Body() dto: CreateContactMessageDto,
  ): Promise<ContactSubmissionResponse> {
    return this.contactService.create(dto);
  }
}
