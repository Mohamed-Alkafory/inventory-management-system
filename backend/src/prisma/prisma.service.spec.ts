import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from './prisma.service.js';

describe('PrismaService', () => {
  const originalDatabaseUrl = process.env['DATABASE_URL'];

  beforeEach(() => {
    // The constructor only needs a syntactically valid URL: the pg pool
    // connects lazily, so these tests never open a socket.
    process.env['DATABASE_URL'] =
      'postgresql://user:password@127.0.0.1:5432/test';
  });

  afterEach(() => {
    vi.restoreAllMocks();

    if (originalDatabaseUrl === undefined) {
      delete process.env['DATABASE_URL'];
    } else {
      process.env['DATABASE_URL'] = originalDatabaseUrl;
    }
  });

  it('throws when DATABASE_URL is missing', () => {
    delete process.env['DATABASE_URL'];

    expect(() => new PrismaService()).toThrow('DATABASE_URL is not set');
  });

  it('keeps serving when the first connection fails at startup', async () => {
    const service = new PrismaService();
    const error = new Error('timeout exceeded when trying to connect');

    vi.spyOn(service, '$connect').mockRejectedValue(error);
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await expect(service.onModuleInit()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('timeout exceeded when trying to connect'),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('continuing and retrying on demand'),
    );
  });

  it('does not leak credentials when logging a connection failure', async () => {
    process.env['DATABASE_URL'] =
      'postgresql://inventory:sup3r-secret@127.0.0.1:5432/test';
    const service = new PrismaService();

    vi.spyOn(service, '$connect').mockRejectedValue(
      new Error(
        'connect failed for postgresql://inventory:sup3r-secret@127.0.0.1:5432/test',
      ),
    );
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await service.onModuleInit();

    const logged = warn.mock.calls[0]?.[0] as string | undefined;

    expect(logged).toBeDefined();
    expect(logged).not.toContain('sup3r-secret');
    expect(logged).toContain('[redacted]');
  });

  it('connects normally when the database is reachable', async () => {
    const service = new PrismaService();
    const connect = vi
      .spyOn(service, '$connect')
      .mockImplementation(() => Promise.resolve());
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await expect(service.onModuleInit()).resolves.toBeUndefined();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });
});
