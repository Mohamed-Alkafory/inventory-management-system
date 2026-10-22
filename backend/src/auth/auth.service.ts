
import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';

/** Number of random bytes behind a refresh token (base64url → 64 chars). */
const REFRESH_TOKEN_BYTES = 48;

/** Refresh tokens live 7 days; rotation happens on every `POST /auth/refresh`. */
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Mirrors the 15m access-token expiry configured on the JwtModule. */
const ACCESS_TOKEN_TTL_SECONDS = 900;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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
        role: user.role,
      },
    };
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
