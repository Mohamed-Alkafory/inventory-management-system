import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { SignOptions } from 'jsonwebtoken';

/** Default access-token lifetime (also mirrored in auth.service.ts). */
const JWT_ACCESS_TTL = '15m';

import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuditModule } from '../audit/audit.module.js';

// Guards are registered once, globally, in AppModule (APP_GUARD). This module
// only provides/exports them so the root registration can resolve them via
// `useExisting`; registering them here too would run every guard twice.
@Module({
  imports: [
    PrismaModule,
    AuditModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') ??
            JWT_ACCESS_TTL) as SignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PermissionsGuard],
  exports: [JwtAuthGuard, PermissionsGuard, JwtModule],
})
export class AuthModule {}
