import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { PrismaExceptionFilter } from './common/prisma-exception.filter.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { parseCorsOrigins } from './common/cors-origins.js';
import { applyTrustProxy } from './common/trust-proxy.js';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { resolveUploadsDir } from './storage/image-storage.service.js';
import { servesLocalUploads } from './storage/image-storage.interface.js';

/** Grace period that lets the fatal log flush before the process exits (ms). */
const FATAL_EXIT_DELAY_MS = 100;

/**
 * Installs process-level handlers before Nest boots, so a failure during
 * startup is reported too. Only the error message is logged — config objects
 * and request payloads may contain secrets.
 */
function installProcessHandlers(): void {
  const fatal = (event: string, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${event}] ${message}`);
    setTimeout(() => process.exit(1), FATAL_EXIT_DELAY_MS);
  };

  process.on('unhandledRejection', (reason) =>
    fatal('unhandledRejection', reason),
  );
  process.on('uncaughtException', (error) =>
    fatal('uncaughtException', error),
  );
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Helmet is registered first so every route added afterwards — including the
  // static uploads and (when enabled) Swagger — carries the security headers.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const configuredCors = config.getOrThrow<string | string[]>('CORS_ORIGIN');
  app.enableCors({
    origin: Array.isArray(configuredCors)
      ? configuredCors
      : parseCorsOrigins(configuredCors),
    credentials: true,
  });

  applyTrustProxy(
    app.getHttpAdapter().getInstance(),
    config.get<number>('TRUST_PROXY') ?? 0,
  );

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const swaggerEnabled =
    !isProduction || config.get<string>('SWAGGER_ENABLED') === 'true';

  if (swaggerEnabled) {
    // Swagger UI ships inline scripts/styles, which the default CSP blocks.
    // Relax it for the docs subtree only; the API keeps the strict policy.
    app.use(
      '/api/docs',
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
          },
        },
      }),
    );

    const documentBuilder = new DocumentBuilder()
      .setTitle('Inventory Management System')
      .setDescription('The inventory management system API description')
      .setVersion('1.0')
      .addTag('inventory')
      .addBearerAuth()
      .build();
    const documentFactory = () =>
      SwaggerModule.createDocument(app, documentBuilder);
    SwaggerModule.setup('api/docs', app, documentFactory);
  }

  // Product images are public and served outside the /api/v1 prefix. With
  // Cloudinary selected, images are served by Cloudinary itself, so the local
  // mount is not installed (and a read-only/ephemeral disk is never exposed).
  if (servesLocalUploads(config.get<string>('IMAGE_STORAGE'))) {
    app.useStaticAssets(resolveUploadsDir(config.get<string>('UPLOADS_DIR')), {
      prefix: '/uploads/',
    });
  }
  // Order matters: Nest evaluates the LAST registered filter first, so the
  // specific Prisma filter must come AFTER the catch-all one; otherwise every
  // Prisma error is swallowed into a generic "Internal Server Error".
  app.useGlobalFilters(new AllExceptionsFilter(), new PrismaExceptionFilter());

  // Lets Prisma disconnect on SIGTERM instead of dropping in-flight work.
  app.enableShutdownHooks();
  await app.listen(config.get('PORT') || 3000, '0.0.0.0');
}

installProcessHandlers();
void bootstrap();
