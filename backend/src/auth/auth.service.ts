import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { type ChangePasswordDto } from './dto/change-password.dto.js';
import { type UpdateProfileDto } from './dto/update-profile.dto.js';

/** Number of random bytes behind a refresh token (base64url → 64 chars). */
const REFRESH_TOKEN_BYTES = 48;

/** Refresh tokens live 7 days; rotation happens on every `POST /auth/refresh`. */
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Mirrors the 15m access-token expiry configured on the JwtModule. */
const ACCESS_TOKEN_TTL_SECONDS = 900;

/** Same work factor as user creation (`UsersService`). */
const BCRYPT_ROUNDS = 10;

/**
 * Public `User` shape (contract §3.1): never selects or returns
 * `passwordHash`.
 */
const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type AuthUserResponse = Prisma.UserGetPayload<{
  select: typeof PUBLIC_USER_SELECT;
}>;

/** What the client may know about the signed-in user (never `passwordHash`). */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildSession(user);
  }

  /**
   * Public self-registration. Always creates a CUSTOMER account (privileged
   * roles are created by an admin through POST /users) and signs it in, so the
   * response has the same shape as `login`. `RegisterDto` has no `role` field;
   * the global whitelist pipe rejects one with 400.
   */
  async register(registerDto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        `User with email ${registerDto.email} already exists`,
      );
    }

    const passwordHash = await bcrypt.hash(registerDto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        name: registerDto.name,
        email: registerDto.email,
        passwordHash,
        role: 'CUSTOMER',
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
      },
    });

    return this.buildSession(user);
  }

  /**
   * `GET /auth/me` — the authenticated user's own public profile. A missing
   * or deactivated account answers 401 (the session is no longer valid).
   */
  async me(userId: string): Promise<AuthUserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PUBLIC_USER_SELECT,
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid session');
    }

    return user;
  }

  /**
   * Rotates a refresh token: the presented token is revoked and a fresh
   * access/refresh pair is issued. Unknown, revoked, expired tokens and
   * deactivated users all yield the same 401 (no token-state disclosure).
   */
  async refresh(refreshTokenDto: RefreshTokenDto) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(refreshTokenDto.refreshToken) },
      include: { user: true },
    });

    if (
      !stored ||
      stored.revokedAt !== null ||
      stored.expiresAt.getTime() <= Date.now() ||
      !stored.user.isActive
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotation: burn the presented token atomically. The conditional update
    // (revokedAt: null) makes concurrent replays single-use — exactly one
    // caller wins the rotation; every other call is rejected.
    const revoked = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (revoked.count !== 1) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const accessToken = await this.signAccessToken(
      stored.user.id,
      stored.user.role,
    );
    const refreshToken = await this.issueRefreshToken(stored.user.id);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  /**
   * Revokes the presented refresh token. Idempotent: an unknown token still
   * ends in 204 — logout never leaks whether the token existed.
   */
  async logout(refreshTokenDto: RefreshTokenDto): Promise<void> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(refreshTokenDto.refreshToken) },
    });

    if (stored && stored.revokedAt === null) {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
    }
  }

  /**
   * `PATCH /auth/me` — editable own-profile fields only (`name`, `password`).
   * Changing the password verifies the current one (422 otherwise), hashes
   * the new one with bcrypt and revokes every active refresh token, so other
   * devices must sign in again.
   */
  async updateMe(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<AuthUserResponse> {
    return this.updateProfile(userId, dto.name, dto.password);
  }

  /**
   * `POST /auth/change-password` — same verification/rotation logic as the
   * nested `PATCH /auth/me` payload; answers 204.
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    await this.updateProfile(userId, undefined, {
      current: dto.currentPassword,
      next: dto.newPassword,
    });
  }

  /**
   * `DELETE /auth/me` — self-deactivation. Deactivates the account and
   * revokes every active refresh token in ONE transaction, so the signed-in
   * session (and any other device) is invalid at once. The last active ADMIN
   * is refused with 409. Idempotent: an
   * already-deactivated account still ends in 204 — the response never
   * leaks whether the account existed. Reactivation is ADMIN-only
   * (`PATCH /users/:id`), exactly like the admin `DELETE /users/:id` flow.
   */
  async deactivate(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: PUBLIC_USER_SELECT,
      });

      if (!user || !user.isActive) {
        return; // already gone or deactivated — nothing to do, still 204
      }

      // The last active ADMIN cannot leave the system without an admin.
      if (user.role === 'ADMIN') {
        const otherActiveAdmins = await tx.user.count({
          where: { role: 'ADMIN', isActive: true, id: { not: userId } },
        });
        if (otherActiveAdmins === 0) {
          throw new ConflictException('At least one active ADMIN must remain');
        }
      }

      await tx.user.update({
        where: { id: userId },
        data: { isActive: false },
        select: { id: true },
      });

      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.audit.log(
        {
          userId,
          action: 'user.deactivated',
          entityType: 'user',
          entityId: userId,
          oldValues: { isActive: true },
          newValues: { isActive: false },
        },
        tx,
      );
    });
  }

  /**
   * Applies profile changes in ONE transaction: user row, refresh-token
   * revocation and the audit entry commit (or roll back) together.
   */
  private updateProfile(
    userId: string,
    name: string | undefined,
    password: { current: string; next: string } | undefined,
  ): Promise<AuthUserResponse> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { ...PUBLIC_USER_SELECT, passwordHash: true },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid session');
      }

      const data: Prisma.UserUpdateInput = {};
      if (name !== undefined) {
        data.name = name;
      }

      if (password) {
        const matches = await bcrypt.compare(
          password.current,
          user.passwordHash,
        );
        if (!matches) {
          throw new UnprocessableEntityException(
            'Current password is incorrect',
          );
        }
        data.passwordHash = await bcrypt.hash(password.next, BCRYPT_ROUNDS);
      }

      const { passwordHash: _currentHash, ...before } = user;

      // Nothing to change: return the current profile without a write.
      if (Object.keys(data).length === 0) {
        return before;
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data,
        select: PUBLIC_USER_SELECT,
      });

      let refreshTokensRevoked = 0;
      if (password) {
        const revoked = await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        refreshTokensRevoked = revoked.count;
      }

      // Issue #34/#54: record the change without any credential material.
      await this.audit.log(
        {
          userId,
          action: password ? 'user.password_changed' : 'user.updated',
          entityType: 'user',
          entityId: userId,
          oldValues: before,
          newValues: {
            ...updated,
            ...(password ? { refreshTokensRevoked } : {}),
          },
        },
        tx,
      );

      return updated;
    });
  }

  private async buildSession(user: SessionUser) {
    const accessToken = await this.signAccessToken(user.id, user.role);
    const refreshToken = await this.issueRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
    };
  }

  private signAccessToken(userId: string, role: string): Promise<string> {
    return this.jwtService.signAsync({ sub: userId, role });
  }

  /**
   * Generates a opaque refresh token and persists ONLY its SHA-256 hash; the
   * raw token exists in the HTTP response exactly once and is never stored.
   */
  private async issueRefreshToken(userId: string): Promise<string> {
    const token = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return token;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
