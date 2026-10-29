import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import {
  NotificationsService,
  type NotificationListResponse,
  type NotificationResponse,
  type PreferenceResponse,
} from './notifications.service.js';
import { ListNotificationsQueryDto } from './dto/list-notifications.query.dto.js';
import { UpdatePreferencesDto } from './dto/update-preferences.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { AnyAuthenticated } from '../auth/decorators/any-authenticated.decorator.js';

/** JWT claim of the signed-in user — notifications are strictly personal. */
interface AuthenticatedUser {
  sub: string;
  role: string;
}

@ApiTags('notifications')
@ApiBearerAuth()
@AnyAuthenticated()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List the current user’s notifications',
    description:
      'Own notifications only (contract §3.9); every authenticated role, including CUSTOMER, can use this route. Customers receive `ORDER_CONFIRMED`/`ORDER_CANCELLED` status alerts for their own orders with `entityType: "order"` and the order id. Filters: `type`, `unread` (boolean — `false` lists read rows). Pagination + whitelisted sort.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated own notifications',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid query parameter',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  findAll(
    @Query() query: ListNotificationsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationListResponse> {
    return this.notificationsService.findAll(user.sub, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Count the current user’s unread notifications' })
  @ApiResponse({ status: HttpStatus.OK, description: '{ count }' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  unreadCount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ count: number }> {
    return this.notificationsService.unreadCount(user.sub);
  }

  @Patch('read-all')
  @ApiOperation({
    summary: 'Mark every unread notification of the current user as read',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '{ updated } — number of rows marked',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  markAllRead(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ updated: number }> {
    return this.notificationsService.markAllRead(user.sub);
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark one notification as read',
    description:
      'Ownership is forced server-side. Another user’s notification (or a missing one) answers 404.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The marked notification',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Malformed id' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Missing or not owned by the caller',
  })
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationResponse> {
    return this.notificationsService.markRead(user.sub, id);
  }

  @Get('preferences')
  @ApiOperation({
    summary: 'Notification preferences of the current user',
    description:
      'Full type list; missing rows report the default `enabled: true` (issue #31 decision — preferences implemented, not dropped; see docs/decisions.md AD-007/AD-021). Types that do not fan out to the caller’s role are still listed and can be toggled harmlessly.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Preference per notification type',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  getPreferences(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PreferenceResponse[]> {
    return this.notificationsService.getPreferences(user.sub);
  }

  @Put('preferences')
  @ApiOperation({
    summary: 'Update notification preferences of the current user',
    description:
      'Array of { type, enabled } upserts; unknown types answer 400.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The updated full preference list',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  updatePreferences(
    @Body() dto: UpdatePreferencesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PreferenceResponse[]> {
    return this.notificationsService.updatePreferences(user.sub, dto);
  }
}
