import { Module } from '@nestjs/common';

import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

/**
 * Notification inbox + preferences for the signed-in user, and the
 * best-effort event fan-out consumed by stock (#17), orders (#28/#29)
 * and purchase orders (#32). All event methods are self-silencing so the
 * main operation can never fail on a notification (#31).
 */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
