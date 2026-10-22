import { Controller, Get } from '@nestjs/common';
import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Public } from '../auth/decorators/public.decorator.js';

// `GET /health` is a public endpoint per the API contract (§1 Authentication)
// so container healthchecks work without a token.
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
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
