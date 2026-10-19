import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { Request, Response } from 'express';
import { errorCodeForStatus } from './error-codes.js';

@Catch(PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number;
    let message: string;

    switch (exception.code) {
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
