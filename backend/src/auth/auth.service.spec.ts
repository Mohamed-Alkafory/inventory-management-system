import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const sha256 = (token: string) =>
  createHash('sha256').update(token).digest('hex');

describe('AuthService', () => {
  let service: AuthService;

  const userFindUnique = vi.fn();
  const refreshTokenCreate = vi.fn();
  const refreshTokenFindUnique = vi.fn();
  const refreshTokenUpdate = vi.fn();
  const refreshTokenUpdateMany = vi.fn();
  const signAsync = vi.fn();

  let adminHash: string;

  const adminRow = () => ({
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Admin User',
    email: 'admin@example.com',
    passwordHash: adminHash,
    role: 'ADMIN' as const,
    isActive: true,
    createdAt: new Date('2026-10-15T00:00:00Z'),
    updatedAt: new Date('2026-10-15T00:00:00Z'),
  });

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
    refreshTokenCreate.mockReset();
    refreshTokenFindUnique.mockReset();
    refreshTokenUpdate.mockReset();
    refreshTokenUpdateMany.mockReset();
    signAsync.mockReset();
    signAsync.mockResolvedValue('signed-access-token');
    refreshTokenCreate.mockResolvedValue({});
    refreshTokenUpdate.mockResolvedValue({});
    refreshTokenUpdateMany.mockResolvedValue({ count: 1 });

    adminHash = await bcrypt.hash('Admin123!', 4);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: userFindUnique },
            refreshToken: {
              create: refreshTokenCreate,
              findUnique: refreshTokenFindUnique,
              update: refreshTokenUpdate,
              updateMany: refreshTokenUpdateMany,
            },
          },
        },
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
});
