import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaExceptionFilter } from './prisma-exception.filter.js';

describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;
  let response: {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
  let request: Partial<Request>;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new PrismaExceptionFilter();

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

  function createPrismaError(code: string) {
    return new PrismaClientKnownRequestError('Test error', {
      code,
      clientVersion: 'test',
    });
  }

  it('maps P2002 to 409 Conflict', () => {
    filter.catch(createPrismaError('P2002'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        message: expect.stringContaining('Resource already exists'),
        error: 'CONFLICT',
        path: '/api/v1/products',
      }),
    );
  });

  it('maps P2025 to 404 Not Found', () => {
    filter.catch(createPrismaError('P2025'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: expect.stringContaining('Resource not found'),
        error: 'NOT_FOUND',
      }),
    );
  });

  it('maps P2003 to 409 Conflict', () => {
    filter.catch(createPrismaError('P2003'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        message: expect.stringContaining('Foreign key constraint failed'),
        error: 'CONFLICT',
      }),
    );
  });

  it('returns the standard response fields', () => {
    filter.catch(createPrismaError('P2002'), host);

    const body = response.json.mock.calls[0][0];

    expect(body).toEqual(
      expect.objectContaining({
        statusCode: expect.any(Number),
        message: expect.any(String),
        error: 'CONFLICT',
        path: '/api/v1/products',
        timestamp: expect.any(String),
      }),
    );

    expect(body.message).toContain('P2002');
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });
});
