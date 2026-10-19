import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { errorCodeForStatus, fieldErrorsFromMessages } from './error-codes.js';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal Server Error';
    let fieldErrors: Record<string, string[]> | undefined;

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
