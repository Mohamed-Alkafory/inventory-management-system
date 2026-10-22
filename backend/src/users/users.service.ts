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
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { ListUsersQueryDto } from './dto/list-users.query.dto.js';

/** Fields any API response may contain — `passwordHash` is never selected. */
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
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
  constructor(private readonly prisma: PrismaService) {}

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

    // Contract §3.2: 422 for self role change / self deactivation.
    if (
      id === currentUserId &&
      updateUserDto.role !== undefined &&
      updateUserDto.role !== user.role
    ) {
      throw new UnprocessableEntityException(
        'Admins cannot change their own role',
      );
    }

    if (id === currentUserId && updateUserDto.isActive === false) {
      throw new UnprocessableEntityException(
        'Admins cannot deactivate their own account',
      );
    }

    const needsAdminGuard =
      user.role === 'ADMIN' &&
      user.isActive &&
      ((updateUserDto.isActive === false) ||
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

    return this.withLastAdminGuard(needsAdminGuard, id, (tx) =>
      tx.user.update({ where: { id }, data, select: USER_SELECT }),
    );
  }

  /**
   * Deactivate (AD-001 soft delete): `isActive = false`, row kept. Enforces
   * the same 422 rules as PATCH with `isActive: false`.
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
      throw new UnprocessableEntityException(
        'Admins cannot deactivate their own account',
      );
    }

    await this.withLastAdminGuard(
      user.role === 'ADMIN' && user.isActive,
      id,
      (tx) => tx.user.update({ where: { id }, data: { isActive: false } }),
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
   * Contract §3.2: 422 when an operation would leave zero active admins.
   *
   * The count and the write run in ONE transaction at the Serializable
   * isolation level, so two admins demoting each other concurrently cannot
   * both succeed and drain the system to zero active admins. PRISMA P2034
   * (write conflict / serialization anomaly) is retried once.
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
              throw new UnprocessableEntityException(
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
        return this.withLastAdminGuard(needsAdminGuard, userId, write, attempt + 1);
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
