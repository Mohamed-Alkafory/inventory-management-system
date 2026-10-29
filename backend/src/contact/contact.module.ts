import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { ContactController } from './contact.controller.js';
import { ContactMessagesController } from './contact-messages.controller.js';
import { ContactService } from './contact.service.js';

/**
 * Contact messages: one public submission route plus the permission-gated
 * support inbox. Status changes are audited inside the update transaction.
 */
@Module({
  imports: [AuditModule],
  controllers: [ContactController, ContactMessagesController],
  providers: [ContactService],
})
export class ContactModule {}
