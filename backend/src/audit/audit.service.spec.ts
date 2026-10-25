import { Test, TestingModule } from '@nestjs/testing';

import {
  AuditService,
  sanitizeAuditValues,
  isSensitiveKey,
} from './audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { type ListAuditLogsQueryDto } from './dto/list-audit-logs.query.dto.js';

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ENTITY_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('AuditService', () => {
  let service: AuditService;
  const create = vi.fn();
  const findMany = vi.fn();
  const count = vi.fn();

  beforeEach(async () => {
    create.mockReset().mockResolvedValue({ id: 'log-1' });
    findMany.mockReset().mockResolvedValue([]);
    count.mockReset().mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: PrismaService,
          useValue: { auditLog: { create, findMany, count } },
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  describe('log', () => {
    it('persists the entry and nulls absent values', async () => {
      await service.log({
        userId: USER_ID,
        action: 'product.created',
        entityType: 'product',
        entityId: ENTITY_ID,
        newValues: { name: 'Pen', price: 1.99 },
      });

      expect(create).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          action: 'product.created',
          entityType: 'product',
          entityId: ENTITY_ID,
          oldValues: Prisma.DbNull,
          newValues: { name: 'Pen', price: 1.99 },
        },
      });
    });

    it('defaults the actor and entity id to null', async () => {
      await service.log({ action: 'order.created', entityType: 'order' });

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: null, entityId: null }),
      });
    });

    it('writes through the caller transaction when one is supplied', async () => {
      const txCreate = vi.fn().mockResolvedValue({ id: 'log-1' });
      const tx = { auditLog: { create: txCreate } } as never;

      await service.log(
        {
          userId: USER_ID,
          action: 'order.created',
          entityType: 'order',
          entityId: ENTITY_ID,
        },
        tx,
      );

      expect(txCreate).toHaveBeenCalledTimes(1);
      expect(create).not.toHaveBeenCalled();
    });

    it('never breaks the main operation when the write fails', async () => {
      create.mockRejectedValue(new Error('connection lost'));

      await expect(
        service.log({
          action: 'product.created',
          entityType: 'product',
          entityId: ENTITY_ID,
        }),
      ).resolves.toBeUndefined();
    });

    it('never stores passwords, hashes, tokens or secrets (#34)', async () => {
      await service.log({
        userId: USER_ID,
        action: 'user.updated',
        entityType: 'user',
        entityId: ENTITY_ID,
        oldValues: {
          email: 'old@example.com',
          passwordHash: '$2b$10$hash',
          refreshToken: 'secret-token',
          nested: { apiSecret: 'shh', name: 'Old Name' },
        },
        newValues: {
          email: 'new@example.com',
          password: 'plaintext',
          tokens: [{ accessToken: 'abc', expiresIn: 900 }],
        },
      });

      const data = create.mock.calls[0][0].data;
      expect(JSON.stringify(data)).not.toContain('$2b$10$hash');
      expect(JSON.stringify(data)).not.toContain('secret-token');
      expect(JSON.stringify(data)).not.toContain('plaintext');
      expect(JSON.stringify(data)).not.toContain('shh');
      expect(data.oldValues).toEqual({
        email: 'old@example.com',
        nested: { name: 'Old Name' },
      });
      expect(data.newValues).toEqual({ email: 'new@example.com' });
    });
  });

  describe('findAll', () => {
    it('applies pagination, filters and the default sort', async () => {
      count.mockResolvedValue(3);
      findMany.mockResolvedValue([{ id: 'log-1' }]);

      const result = await service.findAll({
        page: 2,
        limit: 10,
        userId: USER_ID,
        entityType: 'product',
        entityId: ENTITY_ID,
        action: 'product.updated',
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-31T23:59:59.999Z',
      } as ListAuditLogsQueryDto);

      expect(count).toHaveBeenCalledWith({
        where: {
          userId: USER_ID,
          entityType: 'product',
          entityId: ENTITY_ID,
          action: 'product.updated',
          createdAt: {
            gte: new Date('2026-10-01T00:00:00.000Z'),
            lte: new Date('2026-10-31T23:59:59.999Z'),
          },
        },
      });
      expect(findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        skip: 10,
        take: 10,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: expect.objectContaining({
          oldValues: true,
          newValues: true,
          entityType: true,
        }),
      });
      expect(result).toEqual({
        data: [{ id: 'log-1' }],
        meta: { page: 2, limit: 10, total: 3, totalPages: 1 },
      });
    });

    it('defaults to the first page and honors sort options', async () => {
      await service.findAll({
        sortBy: 'action',
        sortOrder: 'asc',
      } as ListAuditLogsQueryDto);

      expect(count).toHaveBeenCalledWith({ where: {} });
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          orderBy: [{ action: 'asc' }, { id: 'asc' }],
        }),
      );
    });

    it('supports open-ended date ranges', async () => {
      await service.findAll({
        from: '2026-10-01T00:00:00.000Z',
      } as ListAuditLogsQueryDto);

      expect(count).toHaveBeenCalledWith({
        where: { createdAt: { gte: new Date('2026-10-01T00:00:00.000Z') } },
      });
    });

    it('returns an empty envelope when nothing matches', async () => {
      await expect(
        service.findAll({} as ListAuditLogsQueryDto),
      ).resolves.toEqual({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });
  });
});

describe('sanitizeAuditValues', () => {
  it('redacts sensitive keys at every depth, case-insensitively', () => {
    expect(isSensitiveKey('passwordHash')).toBe(true);
    expect(isSensitiveKey('Password')).toBe(true);
    expect(isSensitiveKey('refresh_token')).toBe(true);
    expect(isSensitiveKey('clientSecret')).toBe(true);
    expect(isSensitiveKey('name')).toBe(false);

    const result = sanitizeAuditValues({
      name: 'Pen',
      apiToken: 'abc',
      nested: {
        password: 'p',
        keep: 1,
        list: [{ token: 't', keep: 2 }],
      },
    });

    expect(result).toEqual({
      name: 'Pen',
      nested: { keep: 1, list: [{ keep: 2 }] },
    });
  });

  it('normalizes dates, decimals, bigints and non-finite numbers', () => {
    const result = sanitizeAuditValues({
      at: new Date('2026-10-25T12:00:00.000Z'),
      price: new Prisma.Decimal('12.50'),
      big: BigInt(42),
      bad: Number.POSITIVE_INFINITY,
      nothing: null,
    });

    expect(result).toEqual({
      at: '2026-10-25T12:00:00.000Z',
      price: '12.5',
      big: '42',
      bad: null,
    });
  });

  it('handles circular references without overflowing', () => {
    const value: Record<string, unknown> = { name: 'loop' };
    value.self = value;

    expect(sanitizeAuditValues(value)).toEqual({
      name: 'loop',
      self: '[Circular]',
    });
  });

  it('returns undefined for absent values', () => {
    expect(sanitizeAuditValues(undefined)).toBeUndefined();
    expect(sanitizeAuditValues(null)).toBeUndefined();
  });
});
