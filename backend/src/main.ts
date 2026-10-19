import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { PrismaExceptionFilter } from './common/prisma-exception.filter.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const config = app.get(ConfigService);
  app.enableCors({
    origin: config.getOrThrow('CORS_ORIGIN'),
    credentials: true,
  });
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

  app.use(helmet());
  app.useGlobalFilters(new PrismaExceptionFilter(), new AllExceptionsFilter());
  await app.listen(config.get('PORT') || 3000);
}
void bootstrap();
