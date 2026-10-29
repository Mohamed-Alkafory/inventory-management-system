import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ImageStorageModule } from '../storage/image-storage.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [AuditModule, ImageStorageModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
