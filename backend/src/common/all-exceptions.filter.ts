import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { Request, Response } from 'express';
import { errorCodeForStatus, fieldErrorsFromMessages } from './error-codes.js';

/** Prisma codes that mean "the database itself is unreachable". */
const DB_UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED', // pg driver adapter surfaces connection failures with these
  'ENOTFOUND',
  'ETIMEDOUT',
  'P1001', // "can't reach database server"
  'P1008',
  'P1002',
]);

/** True when the failure is a dead database, not a bug in the request. */
function isDatabaseUnavailable(exception: unknown): boolean {
  if (!(exception instanceof Error)) {
    return false;
  }
  if (exception instanceof PrismaClientKnownRequestError) {
    return (
      typeof exception.code === 'string' &&
      DB_UNAVAILABLE_CODES.has(exception.code)
    );
  }
  return (
    exception.name === 'PrismaClientInitializationError' ||
    /can't reach database server|connection refused|ECONNREFUSED/i.test(
      exception.message,
    )
  );
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal Server Error';
    let fieldErrors: Record<string, string[]> | undefined;

    if (isDatabaseUnavailable(exception)) {
      this.logger.error(
        `Cannot reach the database: ${
          exception instanceof Error ? exception.message : String(exception)
        }. Is the PostgreSQL container running? Start it with \`docker compose up -d db\`.`,
      );
      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message:
          'Database temporarily unavailable. Please try again in a moment.',
        error: errorCodeForStatus(HttpStatus.SERVICE_UNAVAILABLE),
        path: request.url,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();

      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse
      ) {
        const responseMessage = (
          exceptionResponse as Record<string, unknown>
        ).message;

        if (
          typeof responseMessage === 'string' ||
          (Array.isArray(responseMessage) &&
            responseMessage.every((item) => typeof item === 'string'))
        ) {
          message = responseMessage as string | string[];

          // Contract §2: fieldErrors maps JSON key -> messages. Only rendered
          // for validation errors (400 with a messages array).
          if (
            statusCode === HttpStatus.BAD_REQUEST &&
            Array.isArray(message) &&
            message.length > 0
          ) {
            fieldErrors = fieldErrorsFromMessages(message);
          }
        }

        // Explicit fieldErrors on the thrown exception take precedence.
        const explicit = (exceptionResponse as Record<string, unknown>)
          .fieldErrors;
        if (explicit && typeof explicit === 'object' && !Array.isArray(explicit)) {
          fieldErrors = explicit as Record<string, string[]>;
        }
      }
    }

    // Unexpected (non-HTTP) failures must be logged with their stack, or every
    // 500 is invisible in the console.
    if (!(exception instanceof HttpException)) {
      this.logger.error(
        `${request.method} ${request.url} failed: ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(statusCode).json({
      statusCode,
      message,
      error: errorCodeForStatus(statusCode),
      ...(fieldErrors ? { fieldErrors } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
