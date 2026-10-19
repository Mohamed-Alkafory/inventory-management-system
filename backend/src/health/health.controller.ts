import { Controller, Get } from '@nestjs/common';
import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async checkHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ok',
        db: 'up',
      };
    } catch {
      // Standard error shape comes from AllExceptionsFilter; proxies and
      // container healthchecks key off the HTTP 503.
      throw new ServiceUnavailableException({
        message: 'Database unavailable',
        status: 'error',
        db: 'down',
      });
    }
  }
}
