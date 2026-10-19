import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let response: {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
  let request: Partial<Request>;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();

    response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    request = { url: '/api/v1/products' };

    host = {
      switchToHttp: () => ({
        getResponse: () => response as unknown as Response,
        getRequest: () => request as Request,
      }),
    } as ArgumentsHost;
  });

  it('formats a string HttpException correctly', () => {
    filter.catch(
      new HttpException('Access denied', HttpStatus.FORBIDDEN),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: 'Access denied',
        error: 'FORBIDDEN',
        path: '/api/v1/products',
        timestamp: expect.any(String),
      }),
    );
    expect(response.json.mock.calls[0][0]).not.toHaveProperty('fieldErrors');
  });

  it('preserves validation messages as an array', () => {
    filter.catch(
      new BadRequestException({
        message: ['name must be a string', 'price must be a number'],
        error: 'Bad Request',
        statusCode: 400,
      }),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: ['name must be a string', 'price must be a number'],
        error: 'VALIDATION_ERROR',
        fieldErrors: {
          name: ['name must be a string'],
          price: ['price must be a number'],
        },
        path: '/api/v1/products',
        timestamp: expect.any(String),
      }),
    );
  });

  it('collects whitelist violations under their property', () => {
    filter.catch(
      new BadRequestException({
        message: [
          'property tooMany should not exist',
          'each value in items must be an object',
        ],
        error: 'Bad Request',
        statusCode: 400,
      }),
      host,
    );

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: 'VALIDATION_ERROR',
        fieldErrors: {
          tooMany: ['property tooMany should not exist'],
          _: ['each value in items must be an object'],
        },
      }),
    );
  });

  it('returns 500 for an unexpected exception', () => {
    filter.catch(new Error('Internal details'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal Server Error',
      error: 'INTERNAL_ERROR',
      path: '/api/v1/products',
      timestamp: expect.any(String),
    });
  });
});
