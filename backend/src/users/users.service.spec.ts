import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { UsersService, type UserResponse } from './users.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';

describe('UsersService', () => {
  let service: UsersService;

  const userFindUnique = vi.fn();
  const userFindMany = vi.fn();
  const userCount = vi.fn();
  const userCreate = vi.fn();
  const userUpdate = vi.fn();
  const $transactionWithOptions = vi.fn();

  const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
  const STAFF_ID = '22222222-2222-4222-8222-222222222222';

  const adminRow = (): Partial<UserResponse> & { id: string } => ({
    id: ADMIN_ID,
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'ADMIN',
    isActive: true,
    createdAt: new Date('2026-10-15T00:00:00Z'),
    updatedAt: new Date('2026-10-15T00:00:00Z'),
  });

  beforeEach(async () => {
    userFindUnique.mockReset();
    userFindMany.mockReset();
    userCount.mockReset();
    userCreate.mockReset();
    userUpdate.mockReset();
    $transactionWithOptions.mockReset();
    userFindMany.mockResolvedValue([]);
    userCount.mockResolvedValue(0);
    userUpdate.mockResolvedValue(adminRow());
    // The serializable last-admin guard runs its count + write through the
    // transaction client; reuse the same mocks as the transaction client.
    $transactionWithOptions.mockImplementation(
      async (
        fn: (tx: {
          user: {
            count: typeof userCount;
            update: typeof userUpdate;
          };
        }) => Promise<unknown>,
      ) =>
        fn({
          user: { count: userCount, update: userUpdate },
        }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: userFindUnique,
              findMany: userFindMany,
              count: userCount,
              create: userCreate,
              update: userUpdate,
            },
            $transaction: $transactionWithOptions,
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('create', () => {
    it('hashes the password and never returns or persists the plain value', async () => {
      userFindUnique.mockResolvedValue(null);
      userCreate.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
        id: STAFF_ID,
        name: args.data.name,
        email: args.data.email,
        role: args.data.role,
        isActive: true,
        createdAt: new Date('2026-10-20T00:00:00Z'),
        updatedAt: new Date('2026-10-20T00:00:00Z'),
      }));

      const result = await service.create({
        name: 'New User',
        email: 'new@example.com',
        password: 'Secret123!',
        role: 'STAFF',
      });

      const persisted = userCreate.mock.calls[0][0].data;
      expect(persisted.passwordHash).toMatch(/^\$2/);
      expect(persisted.passwordHash).not.toBe('Secret123!');
      expect(result).not.toHaveProperty('passwordHash');
      expect(JSON.stringify(result)).not.toContain('Secret123!');
      expect(userCreate.mock.calls[0][0].select.passwordHash).toBeUndefined();
    });

    it('rejects a duplicate email with 409', async () => {
      userFindUnique.mockResolvedValue({ id: ADMIN_ID });

      await expect(
        service.create({
          name: 'Dup',
          email: 'admin@example.com',
          password: 'Secret123!',
          role: 'STAFF',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(userCreate).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns the contract pagination envelope with safe fields only', async () => {
      userCount.mockResolvedValue(1);
      userFindMany.mockResolvedValue([adminRow()]);

      const result = await service.findAll({});

      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
      expect(result.data).toHaveLength(1);
      expect(userFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: expect.not.objectContaining({ passwordHash: expect.anything() }),
        }),
      );
      expect(JSON.stringify(result)).not.toContain('passwordHash');
    });

    it('applies page/limit/search/role and sort query params', async () => {
      await service.findAll({
        page: 2,
        limit: 5,
        search: 'admin',
        role: 'ADMIN',
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(userFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
          orderBy: { name: 'asc' },
          where: {
            role: 'ADMIN',
            OR: [
              { name: { contains: 'admin', mode: 'insensitive' } },
              { email: { contains: 'admin', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns the user when it exists', async () => {
      userFindUnique.mockResolvedValue(adminRow());

      await expect(service.findOne(ADMIN_ID)).resolves.toEqual(adminRow());
      expect(userFindUnique.mock.calls[0][0].select.passwordHash).toBeUndefined();
    });

    it('throws 404 when it does not exist', async () => {
      userFindUnique.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates the requested fields only', async () => {
      userFindUnique.mockResolvedValue(adminRow());
      userUpdate.mockResolvedValue({ ...adminRow(), name: 'Renamed' });

      const result = await service.update(
        STAFF_ID,
        { name: 'Renamed' },
        ADMIN_ID,
      );

      expect(result.name).toBe('Renamed');
      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: STAFF_ID },
        data: { name: 'Renamed' },
        select: expect.anything(),
      });
    });

    it('rejects a duplicate email with 409', async () => {
      userFindUnique
        .mockResolvedValueOnce(adminRow())
        .mockResolvedValueOnce({ id: STAFF_ID });

      await expect(
        service.update(ADMIN_ID, { email: 'taken@example.com' }, ADMIN_ID),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(userUpdate).not.toHaveBeenCalled();
    });

    it('rejects an admin changing their own role (422)', async () => {
      userFindUnique.mockResolvedValue(adminRow());

      await expect(
        service.update(ADMIN_ID, { role: 'STAFF' }, ADMIN_ID),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(userUpdate).not.toHaveBeenCalled();
    });

    it('rejects an admin deactivating themselves (422)', async () => {
      userFindUnique.mockResolvedValue(adminRow());

      await expect(
        service.update(ADMIN_ID, { isActive: false }, ADMIN_ID),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(userUpdate).not.toHaveBeenCalled();
    });

    it('rejects demoting the last active admin (422)', async () => {
      userFindUnique.mockResolvedValue(adminRow());
      userCount.mockResolvedValue(0);

      await expect(
        service.update(ADMIN_ID, { role: 'STAFF' }, STAFF_ID),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      // The count and the write share one serializable transaction.
      expect($transactionWithOptions).toHaveBeenCalledWith(
        expect.any(Function),
        { isolationLevel: 'Serializable' },
      );
      expect(userCount).toHaveBeenCalledWith({
        where: { role: 'ADMIN', isActive: true, id: { not: ADMIN_ID } },
      });
      expect(userUpdate).not.toHaveBeenCalled();
    });

    it('retries once on a P2034 write conflict and still applies the update', async () => {
      userFindUnique.mockResolvedValue(adminRow());
      userUpdate.mockResolvedValue(adminRow());

      const conflict = new Prisma.PrismaClientKnownRequestError(
        'serialization conflict',
        { code: 'P2034', clientVersion: 'test' },
      );
      $transactionWithOptions
        .mockRejectedValueOnce(conflict)
        // Second attempt runs through the real (mocked) transaction body.
        .mockImplementationOnce(
          async (
            fn: (tx: unknown) => Promise<unknown>,
          ) =>
            fn({
              user: { count: userCount, update: userUpdate },
            }),
        );

      const result = await service.update(
        ADMIN_ID,
        { name: 'Renamed' },
        STAFF_ID,
      );

      expect(result.name).toBe('Admin User');
      expect($transactionWithOptions).toHaveBeenCalledTimes(2);
      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: ADMIN_ID },
        data: { name: 'Renamed' },
        select: expect.anything(),
      });
    });

    it('does not retry non-P2034 failures', async () => {
      userFindUnique.mockResolvedValue(adminRow());
      const boom = new Error('kaboom');
      $transactionWithOptions.mockRejectedValueOnce(boom);

      await expect(
        service.update(ADMIN_ID, { name: 'Renamed' }, STAFF_ID),
      ).rejects.toBe(boom);
      expect($transactionWithOptions).toHaveBeenCalledTimes(1);
    });

    it('throws 404 for a missing user', async () => {
      userFindUnique.mockResolvedValue(null);

      await expect(
        service.update('missing-id', { name: 'X' }, ADMIN_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('soft-deletes by setting isActive=false', async () => {
      userFindUnique.mockResolvedValue({
        ...adminRow(),
        id: STAFF_ID,
        role: 'STAFF' as const,
        email: 'staff@example.com',
      });
      userUpdate.mockResolvedValue({});

      await expect(service.deactivate(STAFF_ID, ADMIN_ID)).resolves.toBeUndefined();

      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: STAFF_ID },
        data: { isActive: false },
      });
    });

    it('rejects self-deactivation (422)', async () => {
      userFindUnique.mockResolvedValue(adminRow());

      await expect(service.deactivate(ADMIN_ID, ADMIN_ID)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(userUpdate).not.toHaveBeenCalled();
    });

    it('rejects deactivating the last active admin (422)', async () => {
      userFindUnique.mockResolvedValue(adminRow());
      userCount.mockResolvedValue(0);

      await expect(service.deactivate(ADMIN_ID, STAFF_ID)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(userUpdate).not.toHaveBeenCalled();
    });

    it('allows deactivating an admin when another active admin remains', async () => {
      userFindUnique.mockResolvedValue(adminRow());
      userCount.mockResolvedValue(1);
      userUpdate.mockResolvedValue({});

      await expect(service.deactivate(ADMIN_ID, STAFF_ID)).resolves.toBeUndefined();
      expect(userUpdate).toHaveBeenCalled();
    });

    it('throws 404 for a missing user', async () => {
      userFindUnique.mockResolvedValue(null);

      await expect(service.deactivate('missing-id', ADMIN_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
