import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
} from '@prisma/client/runtime/client';
import { Request, Response } from 'express';
import { errorCodeForStatus } from './error-codes.js';

@Catch(PrismaClientKnownRequestError, PrismaClientInitializationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception:
      | PrismaClientKnownRequestError
      | PrismaClientInitializationError,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // The database itself is unreachable (container stopped, bad DSN):
    // answer 503 instead of a misleading 500, and log the recovery hint.
    if (exception instanceof PrismaClientInitializationError) {
      this.logger.error(
        `Cannot reach the database: ${exception.message}. ` +
          'Is the PostgreSQL container running? Start it with `docker compose up -d db`.',
      );
      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Database temporarily unavailable. Please try again in a moment.',
        error: errorCodeForStatus(HttpStatus.SERVICE_UNAVAILABLE),
        path: request.url,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    let statusCode: number;
    let message: string;

    switch (exception.code) {
      // Driver-adapter connection failures arrive as "known" request errors
      // whose code is a raw Postgres/node code, not a P-code.
      case 'ECONNREFUSED':
      case 'ENOTFOUND':
      case 'ETIMEDOUT':
      case 'ECONNRESET':
      case 'P1001':
      case 'P1002':
        statusCode = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Database temporarily unavailable. Please try again in a moment.';
        break;

      case 'P2002':
        statusCode = HttpStatus.CONFLICT;
        message = 'Resource already exists';
        break;

      case 'P2025':
        statusCode = HttpStatus.NOT_FOUND;
        message = 'Resource not found';
        break;

      case 'P2003':
        statusCode = HttpStatus.CONFLICT;
        message = 'Foreign key constraint failed';
        break;

      default:
        statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Something went wrong';
        break;
    }

    // `error` is the contract §2 machine-readable code; the raw Prisma code
    // stays embedded in the message context for debugging.
    response.status(statusCode).json({
      statusCode,
      message: `${message} (${exception.code})`,
      error: errorCodeForStatus(statusCode),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
