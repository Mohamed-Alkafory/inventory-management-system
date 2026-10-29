import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermission } from '../auth/decorators/require-permission.decorator.js';
import {
  ContactService,
  type ContactMessageListResponse,
  type ContactMessageResponse,
} from './contact.service.js';
import { ListContactMessagesQueryDto } from './dto/list-contact-messages.query.dto.js';
import { UpdateContactMessageDto } from './dto/update-contact-message.dto.js';

/** JWT user resolved from the database by the global `JwtAuthGuard`. */
interface AuthenticatedUser {
  sub: string;
  role: string;
}

/**
 * Private support inbox. Every route requires `contact.read` (list/detail) or
 * `contact.manage` (triage); only SUPPORT and ADMIN hold those permissions.
 */
@ApiTags('contact-messages')
@ApiBearerAuth()
@Controller('contact-messages')
export class ContactMessagesController {
  constructor(private readonly contactService: ContactService) {}

  @Get()
  @RequirePermission('contact.read')
  @ApiOperation({
    summary: 'List contact messages (SUPPORT and ADMIN)',
    description:
      'Paginated support inbox, newest first with a deterministic `id` tie-break. Optional `status` (NEW, IN_PROGRESS, RESOLVED), `assignedToId` and case-insensitive `search` over name, email and subject. Includes `internalNote` and the assignee snapshot.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated contact-message list',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Validation failed (pagination, status enum, assignee UUID or unknown query field)',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Missing contact.read (STAFF and CUSTOMER)',
  })
  findAll(
    @Query() query: ListContactMessagesQueryDto,
  ): Promise<ContactMessageListResponse> {
    return this.contactService.findAll(query);
  }

  @Get(':id')
  @RequirePermission('contact.read')
  @ApiOperation({
    summary: 'Get a contact message by id (SUPPORT and ADMIN)',
    description:
      'Returns the message plus status, assignee snapshot, timestamps and the internal note. A non-UUID id is 400; an unknown id is 404.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contact message found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'id is not a UUID',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Missing contact.read (STAFF and CUSTOMER)',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Contact message does not exist',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContactMessageResponse> {
    return this.contactService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('contact.manage')
  @ApiOperation({
    summary: 'Triage a contact message (SUPPORT and ADMIN)',
    description:
      'Updates any of `status` (NEW, IN_PROGRESS, RESOLVED), `assignedToId` (an active SUPPORT or ADMIN user, or null to unassign) and `internalNote` (or null to clear). Every status change writes an audit entry with the actor, previous and new status. Unknown message ids and unknown/ineligible assignees answer 404.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Updated contact message',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Validation failed (malformed id, unknown status, invalid assignee UUID or oversized internal note)',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Missing contact.manage (STAFF and CUSTOMER)',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description:
      'Contact message does not exist, or the assignee is unknown/inactive/not SUPPORT or ADMIN',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ContactMessageResponse> {
    return this.contactService.update(id, dto, user.sub);
  }
}
