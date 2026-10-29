import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

const sha256 = (token: string) =>
  createHash('sha256').update(token).digest('hex');

describe('AuthService', () => {
  let service: AuthService;

  const userFindUnique = vi.fn();
  const userCount = vi.fn();
  const userUpdate = vi.fn();
  const userCreate = vi.fn();
  const refreshTokenCreate = vi.fn();
  const refreshTokenFindUnique = vi.fn();
  const refreshTokenUpdate = vi.fn();
  const refreshTokenUpdateMany = vi.fn();
  const $transaction = vi.fn();
  const auditLog = vi.fn();
  const signAsync = vi.fn();

  let adminHash: string;

  const adminRow = () => ({
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Admin User',
    email: 'admin@example.com',
    passwordHash: adminHash,
    avatarUrl: null,
    role: 'ADMIN' as const,
    isActive: true,
    createdAt: new Date('2026-10-15T00:00:00Z'),
    updatedAt: new Date('2026-10-15T00:00:00Z'),
  });

  const publicAdmin = (overrides: Record<string, unknown> = {}) => {
    const { passwordHash: _hash, ...safe } = adminRow();
    return { ...safe, ...overrides };
  };

  const storedTokenRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    userId: adminRow().id,
    tokenHash: sha256('stored-token'),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    revokedAt: null,
    createdAt: new Date(),
    user: { id: adminRow().id, role: 'ADMIN', isActive: true },
    ...overrides,
  });

  beforeEach(async () => {
    userFindUnique.mockReset();
    userCount.mockReset();
    userUpdate.mockReset();
    userCreate.mockReset();
    refreshTokenCreate.mockReset();
    refreshTokenFindUnique.mockReset();
    refreshTokenUpdate.mockReset();
    refreshTokenUpdateMany.mockReset();
    $transaction.mockReset();
    auditLog.mockReset();
    signAsync.mockReset();
    signAsync.mockResolvedValue('signed-access-token');
    refreshTokenCreate.mockResolvedValue({});
    refreshTokenUpdate.mockResolvedValue({});
    refreshTokenUpdateMany.mockResolvedValue({ count: 1 });
    userCount.mockResolvedValue(1);
    userUpdate.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(publicAdmin(data)),
    );

    const tx = {
      user: { findUnique: userFindUnique, count: userCount, update: userUpdate },
      refreshToken: {
        create: refreshTokenCreate,
        updateMany: refreshTokenUpdateMany,
      },
    };
    $transaction.mockImplementation((fn: (client: typeof tx) => unknown) =>
      fn(tx),
    );

    adminHash = await bcrypt.hash('Admin123!', 4);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: userFindUnique,
              count: userCount,
              update: userUpdate,
              create: userCreate,
            },
            refreshToken: {
              create: refreshTokenCreate,
              findUnique: refreshTokenFindUnique,
              update: refreshTokenUpdate,
              updateMany: refreshTokenUpdateMany,
            },
            $transaction,
          },
        },
        { provide: AuditService, useValue: { log: auditLog } },
        {
          provide: JwtService,
          useValue: { signAsync },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('returns an access token, a refresh token and the safe user shape', async () => {
      userFindUnique.mockResolvedValue(adminRow());

      const result = await service.login({
        email: 'admin@example.com',
        password: 'Admin123!',
      });

      expect(result.accessToken).toBe('signed-access-token');
      expect(result.tokenType).toBe('Bearer');
      expect(result.user).toEqual({
        id: adminRow().id,
        name: 'Admin User',
        email: 'admin@example.com',
        avatarUrl: null,
        role: 'ADMIN',
      });
      expect(JSON.stringify(result)).not.toContain('passwordHash');
      expect(signAsync).toHaveBeenCalledWith({
        sub: adminRow().id,
        role: 'ADMIN',
      });
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken.length).toBeGreaterThanOrEqual(43);
    });

    it('stores only the SHA-256 hash of the refresh token, never the raw token', async () => {
      userFindUnique.mockResolvedValue(adminRow());

      const result = await service.login({
        email: 'admin@example.com',
        password: 'Admin123!',
      });

      expect(refreshTokenCreate).toHaveBeenCalledTimes(1);
      const data = refreshTokenCreate.mock.calls[0][0].data;
      expect(data.userId).toBe(adminRow().id);
      expect(data.tokenHash).toBe(sha256(result.refreshToken));
      expect(data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(data.tokenHash).not.toBe(result.refreshToken);
      expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now());
      // Raw token must never be persisted anywhere.
      expect(JSON.stringify(data)).not.toContain(result.refreshToken);
    });

    it('rejects an unknown email', async () => {
      userFindUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@example.com', password: 'whatever1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(signAsync).not.toHaveBeenCalled();
      expect(refreshTokenCreate).not.toHaveBeenCalled();
    });

    it('rejects a wrong password', async () => {
      userFindUnique.mockResolvedValue(adminRow());

      await expect(
        service.login({ email: 'admin@example.com', password: 'Wrong123!' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(refreshTokenCreate).not.toHaveBeenCalled();
    });

    it('rejects an inactive user', async () => {
      userFindUnique.mockResolvedValue({ ...adminRow(), isActive: false });

      await expect(
        service.login({ email: 'admin@example.com', password: 'Admin123!' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(refreshTokenCreate).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    const dto = { refreshToken: 'presented-refresh-token-abc' };

    it('looks the token up by hash and returns a rotated pair', async () => {
      refreshTokenFindUnique.mockResolvedValue(storedTokenRow());
      signAsync.mockResolvedValue('rotated-access-token');

      const result = await service.refresh(dto);

      expect(refreshTokenFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tokenHash: sha256(dto.refreshToken) },
        }),
      );
      expect(result.accessToken).toBe('rotated-access-token');
      expect(result.refreshToken).not.toBe(dto.refreshToken);
      // Rotation: the presented token is revoked atomically — the
      // conditional update only matches a yet-unrevoked token.
      expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
        where: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
      expect(refreshTokenCreate).toHaveBeenCalledTimes(1);
    });

    it('rejects a concurrent replay whose conditional revocation matched zero rows', async () => {
      refreshTokenFindUnique.mockResolvedValue(storedTokenRow());
      refreshTokenUpdateMany.mockResolvedValue({ count: 0 });

      await expect(service.refresh(dto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokenCreate).not.toHaveBeenCalled();
    });

    it('rejects an unknown token', async () => {
      refreshTokenFindUnique.mockResolvedValue(null);

      await expect(service.refresh(dto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokenUpdate).not.toHaveBeenCalled();
      expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
    });

    it('rejects an already-rotated (revoked) token', async () => {
      refreshTokenFindUnique.mockResolvedValue(
        storedTokenRow({ revokedAt: new Date() }),
      );

      await expect(service.refresh(dto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokenUpdate).not.toHaveBeenCalled();
      expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
      expect(refreshTokenCreate).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      refreshTokenFindUnique.mockResolvedValue(
        storedTokenRow({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.refresh(dto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokenUpdate).not.toHaveBeenCalled();
      expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
    });

    it('rejects refresh for a deactivated user', async () => {
      refreshTokenFindUnique.mockResolvedValue(
        storedTokenRow({
          user: { id: adminRow().id, role: 'ADMIN', isActive: false },
        }),
      );

      await expect(service.refresh(dto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokenUpdate).not.toHaveBeenCalled();
      expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    const dto = { refreshToken: 'presented-refresh-token-abc' };

    it('revokes the presented token', async () => {
      refreshTokenFindUnique.mockResolvedValue(storedTokenRow());
      refreshTokenUpdate.mockResolvedValue({});

      await expect(service.logout(dto)).resolves.toBeUndefined();

      expect(refreshTokenFindUnique).toHaveBeenCalledWith({
        where: { tokenHash: sha256(dto.refreshToken) },
      });
      expect(refreshTokenUpdate).toHaveBeenCalledWith({
        where: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('is idempotent for unknown tokens', async () => {
      refreshTokenFindUnique.mockResolvedValue(null);

      await expect(service.logout(dto)).resolves.toBeUndefined();
      expect(refreshTokenUpdate).not.toHaveBeenCalled();
      expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    const dto = {
      name: 'New Customer',
      email: 'customer@example.com',
      password: 'Customer123!',
    };

    it('always creates a CUSTOMER account (hashed password) and signs it in', async () => {
      userFindUnique.mockResolvedValue(null);
      userCreate.mockImplementation(
        ({ data }: { data: Record<string, string> }) =>
          Promise.resolve({
            id: '22222222-2222-4222-8222-222222222222',
            name: data.name,
            email: data.email,
            avatarUrl: null,
            role: data.role,
          }),
      );

      const result = await service.register(dto);

      const data = userCreate.mock.calls[0][0].data;
      expect(data.role).toBe('CUSTOMER');
      expect(data.passwordHash).not.toBe(dto.password);
      await expect(bcrypt.compare(dto.password, data.passwordHash)).resolves.toBe(true);
      expect(result.user).toEqual({
        id: '22222222-2222-4222-8222-222222222222',
        name: 'New Customer',
        email: 'customer@example.com',
        avatarUrl: null,
        role: 'CUSTOMER',
      });
      expect(result.accessToken).toBe('signed-access-token');
      expect(typeof result.refreshToken).toBe('string');
      expect(JSON.stringify(result)).not.toContain('passwordHash');
    });

    it('rejects an email that is already registered with 409', async () => {
      userFindUnique.mockResolvedValue({ id: 'x' });

      await expect(service.register(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(userCreate).not.toHaveBeenCalled();
    });
  });

  describe('me', () => {
    it('returns the public profile without the password hash', async () => {
      userFindUnique.mockResolvedValue(publicAdmin());

      const result = await service.me(adminRow().id);

      expect(userFindUnique).toHaveBeenCalledWith({
        where: { id: adminRow().id },
        select: expect.objectContaining({ email: true, isActive: true }),
      });
      expect(result).toEqual(publicAdmin());
      expect(JSON.stringify(result)).not.toContain('passwordHash');
      expect(JSON.stringify(result)).not.toContain(adminHash);
    });

    it('answers 401 for an unknown user', async () => {
      userFindUnique.mockResolvedValue(null);

      await expect(service.me('missing')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('answers 401 for a deactivated user', async () => {
      userFindUnique.mockResolvedValue(publicAdmin({ isActive: false }));

      await expect(service.me(adminRow().id)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('updateMe', () => {
    it('updates the name inside a transaction and audits it', async () => {
      userFindUnique.mockResolvedValue(adminRow());
      userUpdate.mockResolvedValue(publicAdmin({ name: 'Renamed Admin' }));

      const result = await service.updateMe(adminRow().id, {
        name: 'Renamed Admin',
      });

      expect($transaction).toHaveBeenCalledTimes(1);
      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: adminRow().id },
        data: { name: 'Renamed Admin' },
        select: expect.objectContaining({ email: true, isActive: true }),
      });
      expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
      expect(result).toEqual(publicAdmin({ name: 'Renamed Admin' }));
      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: adminRow().id,
          action: 'user.updated',
          entityType: 'user',
          entityId: adminRow().id,
          oldValues: expect.objectContaining({ name: 'Admin User' }),
        }),
        expect.anything(),
      );
    });

    it('rejects a wrong current password with 422 and writes nothing', async () => {
      userFindUnique.mockResolvedValue(adminRow());

      await expect(
        service.updateMe(adminRow().id, {
          password: { current: 'Wrong123!', next: 'NewPass123!' },
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(userUpdate).not.toHaveBeenCalled();
      expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
      expect(auditLog).not.toHaveBeenCalled();
    });

    it('hashes the new password and revokes every active refresh token', async () => {
      userFindUnique.mockResolvedValue(adminRow());
      userUpdate.mockResolvedValue(publicAdmin());

      await service.updateMe(adminRow().id, {
        password: { current: 'Admin123!', next: 'NewPass123!' },
      });

      const data = userUpdate.mock.calls[0][0].data;
      expect(data.passwordHash).toBeDefined();
      expect(data.passwordHash).not.toBe('NewPass123!');
      expect(data.passwordHash).not.toBe(adminHash);
      expect(await bcrypt.compare('NewPass123!', data.passwordHash)).toBe(true);
      expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
        where: { userId: adminRow().id, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('audits a password change without any credential material', async () => {
      userFindUnique.mockResolvedValue(adminRow());
      userUpdate.mockResolvedValue(publicAdmin());

      await service.updateMe(adminRow().id, {
        password: { current: 'Admin123!', next: 'NewPass123!' },
      });

      expect(auditLog).toHaveBeenCalledTimes(1);
      const entry = auditLog.mock.calls[0][0];
      expect(entry).toMatchObject({
        userId: adminRow().id,
        action: 'user.password_changed',
        entityType: 'user',
        entityId: adminRow().id,
        newValues: { refreshTokensRevoked: 1 },
      });
      const stored = JSON.stringify(entry);
      expect(stored).not.toContain('NewPass123!');
      expect(stored).not.toContain('Admin123!');
      expect(stored).not.toContain(adminHash);
      expect(stored).not.toContain('passwordHash');
    });

    it('applies name and password together', async () => {
      userFindUnique.mockResolvedValue(adminRow());
      userUpdate.mockResolvedValue(publicAdmin({ name: 'Renamed' }));

      const result = await service.updateMe(adminRow().id, {
        name: 'Renamed',
        password: { current: 'Admin123!', next: 'NewPass123!' },
      });

      expect(result.name).toBe('Renamed');
      expect(userUpdate.mock.calls[0][0].data).toEqual({
        name: 'Renamed',
        passwordHash: expect.any(String),
      });
      expect(refreshTokenUpdateMany).toHaveBeenCalledTimes(1);
    });

    it('returns the current profile without writing when nothing changed', async () => {
      userFindUnique.mockResolvedValue(adminRow());

      const result = await service.updateMe(adminRow().id, {});

      expect(result).toEqual(publicAdmin());
      expect(userUpdate).not.toHaveBeenCalled();
      expect(auditLog).not.toHaveBeenCalled();
    });

    it('answers 401 when the session user no longer exists', async () => {
      userFindUnique.mockResolvedValue(null);

      await expect(
        service.updateMe(adminRow().id, { name: 'X Y' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('changePassword', () => {
    it('changes the password and resolves with no content', async () => {
      userFindUnique.mockResolvedValue(adminRow());
      userUpdate.mockResolvedValue(publicAdmin());

      await expect(
        service.changePassword(adminRow().id, {
          currentPassword: 'Admin123!',
          newPassword: 'NewPass123!',
        }),
      ).resolves.toBeUndefined();

      expect(
        await bcrypt.compare(
          'NewPass123!',
          userUpdate.mock.calls[0][0].data.passwordHash,
        ),
      ).toBe(true);
      expect(refreshTokenUpdateMany).toHaveBeenCalledTimes(1);
      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.password_changed' }),
        expect.anything(),
      );
    });

    it('rejects a wrong current password with 422', async () => {
      userFindUnique.mockResolvedValue(adminRow());

      await expect(
        service.changePassword(adminRow().id, {
          currentPassword: 'Wrong123!',
          newPassword: 'NewPass123!',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(userUpdate).not.toHaveBeenCalled();
      expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('deactivates the account, revokes refresh tokens and audits it', async () => {
      userFindUnique.mockResolvedValue(adminRow());
      userUpdate.mockResolvedValue({});
      userCount.mockResolvedValue(1);

      await expect(service.deactivate(adminRow().id)).resolves.toBeUndefined();

      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: adminRow().id },
        data: { isActive: false },
        select: { id: true },
      });
      expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
        where: { userId: adminRow().id, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.deactivated' }),
        expect.anything(),
      );
    });

    it('rejects deactivating the last active admin with 409', async () => {
      userFindUnique.mockResolvedValue(adminRow());
      userCount.mockResolvedValue(0);

      await expect(service.deactivate(adminRow().id)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(userUpdate).not.toHaveBeenCalled();
      expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
    });

    it('is idempotent for an already deactivated account', async () => {
      userFindUnique.mockResolvedValue({ ...adminRow(), isActive: false });

      await expect(service.deactivate(adminRow().id)).resolves.toBeUndefined();

      expect(userCount).not.toHaveBeenCalled();
      expect(userUpdate).not.toHaveBeenCalled();
    });
  });
});
