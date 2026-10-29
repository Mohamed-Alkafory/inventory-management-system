import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { PrismaExceptionFilter } from './common/prisma-exception.filter.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { resolveUploadsDir } from './storage/image-storage.service.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  const corsOrigin = config.getOrThrow<string>('CORS_ORIGIN');
  app.enableCors({
    origin: Array.isArray(corsOrigin) ? corsOrigin : [corsOrigin],
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
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

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Product images are public and served outside the /api/v1 prefix. Registered
  // after Helmet so the image responses carry the same security headers.
  app.useStaticAssets(resolveUploadsDir(config.get<string>('UPLOADS_DIR')), {
    prefix: '/uploads/',
  });
  // Order matters: Nest evaluates the LAST registered filter first, so the
  // specific Prisma filter must come AFTER the catch-all one; otherwise every
  // Prisma error is swallowed into a generic "Internal Server Error".
  app.useGlobalFilters(new AllExceptionsFilter(), new PrismaExceptionFilter());
  await app.listen(config.get('PORT') || 3000);
}
void bootstrap();
