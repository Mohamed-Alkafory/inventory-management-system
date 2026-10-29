import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { UserRole } from '../generated/prisma/enums.js';
import { AuditService } from '../audit/audit.service.js';
import {
  ImageStorageService,
  MAX_AVATAR_SIZE_BYTES,
  type UploadedImageFile,
} from '../storage/image-storage.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { ListUsersQueryDto } from './dto/list-users.query.dto.js';

/** Fields any API response may contain — `passwordHash` is never selected. */
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

/** Contract §3.1 `User` shape (no `passwordHash`, ever). */
export interface UserResponse {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsersPageResponse {
  data: UserResponse[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const BCRYPT_ROUNDS = 10;
const DEFAULT_PAGE_SIZE = 20;
const P2034_RETRY_DELAY_MS = 50;
const MAX_SERIALIZATION_RETRIES = 1;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly images: ImageStorageService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponse> {
    await this.assertEmailAvailable(createUserDto.email);

    const passwordHash = await bcrypt.hash(
      createUserDto.password,
      BCRYPT_ROUNDS,
    );

    const user = await this.prisma.user.create({
      data: {
        name: createUserDto.name,
        email: createUserDto.email,
        passwordHash,
        role: createUserDto.role,
      },
      select: USER_SELECT,
    });

    return user;
  }

  async findAll(query: ListUsersQueryDto): Promise<UsersPageResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder } as Prisma.UserOrderByWithRelationInput,
        select: USER_SELECT,
      }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    currentUserId: string,
  ): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    if (
      updateUserDto.email !== undefined &&
      updateUserDto.email !== user.email
    ) {
      await this.assertEmailAvailable(updateUserDto.email);
    }

    const selfRoleChange =
      id === currentUserId &&
      updateUserDto.role !== undefined &&
      updateUserDto.role !== user.role;
    const selfDeactivation =
      id === currentUserId && updateUserDto.isActive === false;
    const selfWouldRemoveActiveAdmin =
      user.role === 'ADMIN' &&
      user.isActive &&
      (selfRoleChange || selfDeactivation);

    // The last active ADMIN can never be demoted or deactivated, including by
    // themselves; this takes precedence over the generic self-change 422.
    if (selfWouldRemoveActiveAdmin) {
      const otherActiveAdmins = await this.prisma.user.count({
        where: { role: 'ADMIN', isActive: true, id: { not: id } },
      });
      if (otherActiveAdmins === 0) {
        throw new ConflictException('At least one active ADMIN must remain');
      }
    }

    // Contract §3.2: 422 for self role change / self deactivation.
    if (selfRoleChange) {
      throw new UnprocessableEntityException(
        'Admins cannot change their own role',
      );
    }

    if (selfDeactivation) {
      throw new UnprocessableEntityException(
        'Admins cannot deactivate their own account',
      );
    }

    const needsAdminGuard =
      user.role === 'ADMIN' &&
      user.isActive &&
      (updateUserDto.isActive === false ||
        (updateUserDto.role !== undefined && updateUserDto.role !== 'ADMIN'));

    const data: Prisma.UserUncheckedUpdateInput = {};
    if (updateUserDto.name !== undefined) {
      data.name = updateUserDto.name;
    }
    if (updateUserDto.email !== undefined) {
      data.email = updateUserDto.email;
    }
    if (updateUserDto.role !== undefined) {
      data.role = updateUserDto.role;
    }
    if (updateUserDto.isActive !== undefined) {
      data.isActive = updateUserDto.isActive;
    }

    const roleChanged =
      updateUserDto.role !== undefined && updateUserDto.role !== user.role;
    const deactivated =
      updateUserDto.isActive === false && user.isActive;

    return this.withLastAdminGuard(needsAdminGuard, id, async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data,
        select: USER_SELECT,
      });

      // A role change or deactivation invalidates every active session.
      let refreshTokensRevoked = 0;
      if (roleChanged || deactivated) {
        const revoked = await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        refreshTokensRevoked = revoked.count;
      }

      // Issue #34: actor + before/after inside the guard transaction.
      await this.audit.log(
        {
          userId: currentUserId,
          action: 'user.updated',
          entityType: 'user',
          entityId: id,
          oldValues: user,
          newValues: {
            ...updated,
            ...(roleChanged || deactivated ? { refreshTokensRevoked } : {}),
          },
        },
        tx,
      );

      return updated;
    });
  }

  /**
   * Replaces the authenticated user's avatar. The new file is written first;
   * if the database update fails it is removed again so no orphan is left
   * behind. The previous local file is deleted only after the DB update.
   */
  async updateAvatar(
    userId: string,
    file: UploadedImageFile | undefined,
  ): Promise<UserResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT,
    });

    if (!existing) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const avatarUrl = await this.images.save(
      file,
      'avatars',
      MAX_AVATAR_SIZE_BYTES,
    );

    let updated: UserResponse;
    try {
      updated = await this.prisma.user.update({
        where: { id: userId },
        data: { avatarUrl },
        select: USER_SELECT,
      });
    } catch (error) {
      await this.images.delete(avatarUrl);
      throw error;
    }

    await this.images.delete(existing.avatarUrl);

    await this.audit.log({
      userId,
      action: 'user.avatar_updated',
      entityType: 'user',
      entityId: userId,
      oldValues: existing,
      newValues: updated,
    });

    return updated;
  }

  /**
   * Clears the authenticated user's avatar. The local file is removed only
   * after the database update succeeds; external URLs are never touched.
   */
  async removeAvatar(userId: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT,
    });

    if (!existing) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
      select: USER_SELECT,
    });

    await this.images.delete(existing.avatarUrl);

    await this.audit.log({
      userId,
      action: 'user.avatar_deleted',
      entityType: 'user',
      entityId: userId,
      oldValues: existing,
      newValues: updated,
    });
  }

  /**
   * Deactivate (AD-001 soft delete): `isActive = false`, row kept. Enforces
   * the same 422 self-deactivation rule as PATCH, plus the last-active-ADMIN
   * 409 safety rule, and revokes every active refresh token.
   */
  async deactivate(id: string, currentUserId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    if (id === currentUserId) {
      // The last active ADMIN can never be deactivated, even by themselves.
      if (user.role === 'ADMIN' && user.isActive) {
        const otherActiveAdmins = await this.prisma.user.count({
          where: { role: 'ADMIN', isActive: true, id: { not: id } },
        });
        if (otherActiveAdmins === 0) {
          throw new ConflictException('At least one active ADMIN must remain');
        }
      }

      throw new UnprocessableEntityException(
        'Admins cannot deactivate their own account',
      );
    }

    await this.withLastAdminGuard(
      user.role === 'ADMIN' && user.isActive,
      id,
      async (tx) => {
        const updated = await tx.user.update({
          where: { id },
          data: { isActive: false },
          select: USER_SELECT,
        });

        // Deactivation invalidates every active session immediately.
        const revoked = await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });

        await this.audit.log(
          {
            userId: currentUserId,
            action: 'user.deactivated',
            entityType: 'user',
            entityId: id,
            oldValues: user,
            newValues: { ...updated, refreshTokensRevoked: revoked.count },
          },
          tx,
        );

        return updated;
      },
    );
  }

  private async assertEmailAvailable(email: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(`User with email ${email} already exists`);
    }
  }

  /**
   * Safety rule: an operation must never leave zero active admins. The count
   * and the write run in ONE transaction at the Serializable isolation level,
   * so two admins demoting each other concurrently cannot both succeed and
   * drain the system to zero active admins. PRISMA P2034 (write conflict /
   * serialization anomaly) is retried once. Violations answer 409.
   */
  private withLastAdminGuard<T>(
    needsAdminGuard: boolean,
    userId: string,
    write: (tx: Prisma.TransactionClient) => Promise<T>,
    attempt = 0,
  ): Promise<T> {
    const run = () =>
      this.prisma.$transaction(
        async (tx) => {
          if (needsAdminGuard) {
            const otherActiveAdmins = await tx.user.count({
              where: { role: 'ADMIN', isActive: true, id: { not: userId } },
            });

            if (otherActiveAdmins === 0) {
              throw new ConflictException(
                'At least one active ADMIN must remain',
              );
            }
          }

          return write(tx);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

    return run().catch(async (error: unknown) => {
      if (attempt < MAX_SERIALIZATION_RETRIES && isWriteConflict(error)) {
        await sleep(P2034_RETRY_DELAY_MS);
        return this.withLastAdminGuard(
          needsAdminGuard,
          userId,
          write,
          attempt + 1,
        );
      }
      throw error;
    });
  }
}

function isWriteConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2034'
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
