import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs.query.dto.js';
import { PERMISSIONS_KEY } from '../auth/decorators/require-permission.decorator.js';

describe('AuditController', () => {
  let controller: AuditController;
  let reflector: Reflector;
  const findAll = vi.fn();

  beforeEach(async () => {
    findAll.mockReset().mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [{ provide: AuditService, useValue: { findAll } }],
    }).compile();

    controller = module.get<AuditController>(AuditController);
    reflector = module.get(Reflector);
  });

  it('forwards the query to the service', async () => {
    const query = {
      entityType: 'product',
      action: 'product.updated',
    } as ListAuditLogsQueryDto;

    await controller.findAll(query);

    expect(findAll).toHaveBeenCalledWith(query);
  });

  it('is ADMIN-only via audit.read (class-level guard)', () => {
    expect(reflector.get<string[]>(PERMISSIONS_KEY, AuditController)).toEqual([
      'audit.read',
    ]);
  });

  it('exposes no write routes — logs are read-only via the API', () => {
    const handlers = Reflect.getMetadata(
      'path',
      AuditController.prototype,
    ) as string;

    expect(handlers).toBeUndefined();
    expect(
      (AuditController.prototype as Record<string, unknown>).create,
    ).toBeUndefined();
    expect(
      (AuditController.prototype as Record<string, unknown>).update,
    ).toBeUndefined();
    expect(
      (AuditController.prototype as Record<string, unknown>).remove,
    ).toBeUndefined();
  });

  describe('input validation (400)', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const validate = (value: unknown) =>
      pipe.transform(value, { type: 'query', metatype: ListAuditLogsQueryDto });

    it('accepts a fully filtered query', async () => {
      await expect(
        validate({
          page: '2',
          limit: '50',
          userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          entityType: 'order',
          entityId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          action: 'order.cancelled',
          from: '2026-10-01T00:00:00.000Z',
          to: '2026-10-31T23:59:59.999Z',
          sortBy: 'action',
          sortOrder: 'asc',
        }),
      ).resolves.toMatchObject({ page: 2, limit: 50, sortBy: 'action' });
    });

    it.each([
      ['a non-uuid userId', { userId: 'not-a-uuid' }],
      ['a non-date from', { from: 'yesterday' }],
      ['a non-date to', { to: 'never' }],
      ['an unsupported sortBy', { sortBy: 'userId' }],
      ['an unsupported sortOrder', { sortOrder: 'sideways' }],
      ['an unknown filter', { isRead: 'true' }],
      ['page 0', { page: 0 }],
      ['limit above 100', { limit: 101 }],
    ] as const)('rejects %s', async (_name, bad) => {
      await expect(validate(bad)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
