import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AuditService, type AuditLogListResponse } from './audit.service.js';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs.query.dto.js';
import { RequirePermission } from '../auth/decorators/require-permission.decorator.js';

/**
 * Read-only audit trail (issue #34). Entries are created by the services
 * that perform mutations; there is deliberately no POST/PATCH/DELETE route,
 * so logs cannot be edited or removed through the API.
 */
@ApiTags('audit-logs')
@ApiBearerAuth()
@RequirePermission('audit.read')
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({
    summary: 'List audit log entries (ADMIN)',
    description:
      'Paginated, read-only audit trail. Filters: `userId`, `entityType`, `entityId`, `action` (exact matches) and an inclusive `from`/`to` date range on `createdAt`. Sorted by `createdAt` (default) or `action`.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated audit log entries',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid filter or pagination',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'ADMIN only' })
  findAll(
    @Query() query: ListAuditLogsQueryDto,
  ): Promise<AuditLogListResponse> {
    return this.auditService.findAll(query);
  }
}
