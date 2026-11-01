import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { parsePgPoolSettings } from './pool-options.js';

/** Hide credentials before a connection error reaches the logs. */
function redactConnectionSecrets(message: string, url: string): string {
  return message
    .split(url)
    .join('[redacted]')
    .replace(/\/\/[^@\s]+@/g, '//[redacted]@');
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly connectionString: string;

  constructor() {
    const url = process.env['DATABASE_URL'];
    if (!url) {
      throw new Error('DATABASE_URL is not set. Cannot create PrismaService.');
    }

    super({
      adapter: new PrismaPg({
        connectionString: url,
        // Bounds the wait for a connection so a suspended/free database cannot
        // hold a request forever (pg defaults connectionTimeoutMillis to 0).
        ...parsePgPoolSettings(),
      }),
    });

    this.connectionString = url;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch (error) {
      // A sleeping or unreachable database must not abort the boot: the app
      // keeps serving, and the first real query retries (the exception filters
      // map a still-unavailable database to the standard 503 response).
      const message =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Database connection failed during startup; continuing and retrying on demand: ${redactConnectionSecrets(message, this.connectionString)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
