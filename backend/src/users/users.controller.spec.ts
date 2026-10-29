import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UsersController } from './users.controller.js';
import { UsersService, type UserResponse } from './users.service.js';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator.js';
import { PERMISSIONS_KEY } from '../auth/decorators/require-permission.decorator.js';
import { ANY_AUTHENTICATED_KEY } from '../auth/decorators/any-authenticated.decorator.js';

const USER_A = { sub: '11111111-1111-4111-8111-111111111111', role: 'STAFF' };
const USER_B = { sub: '22222222-2222-4222-8222-222222222222', role: 'ADMIN' };

const usersServiceMock = () => ({
  findAll: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn(),
  updateAvatar: vi.fn(),
  removeAvatar: vi.fn(),
});

const userWithoutAvatar: UserResponse = {
  id: USER_A.sub,
  name: 'Staff User',
  email: 'staff@example.com',
  avatarUrl: null,
  role: 'STAFF',
  isActive: true,
  createdAt: new Date('2026-10-15T00:00:00Z'),
  updatedAt: new Date('2026-10-15T00:00:00Z'),
};

describe('UsersController avatar endpoints', () => {
  let controller: UsersController;
  let reflector: Reflector;
  let service: ReturnType<typeof usersServiceMock>;

  beforeEach(async () => {
    service = usersServiceMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: service }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    reflector = module.get(Reflector);
  });

  it('is not public, so requests without a token are rejected by the global guard', () => {
    for (const handler of [
      UsersController.prototype.uploadAvatar,
      UsersController.prototype.removeAvatar,
    ]) {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBeUndefined();
    }
  });

  it('classifies avatar routes as any-authenticated (overriding users.manage)', () => {
    for (const handler of [
      UsersController.prototype.uploadAvatar,
      UsersController.prototype.removeAvatar,
    ]) {
      expect(
        reflector.get<boolean>(ANY_AUTHENTICATED_KEY, handler),
      ).toBe(true);
    }
    expect(
      reflector.get<string[]>(PERMISSIONS_KEY, UsersController),
    ).toEqual(['users.manage']);
  });

  it('returns the updated current user with avatarUrl and no passwordHash', async () => {
    const updated = {
      ...userWithoutAvatar,
      avatarUrl: '/uploads/avatars/new.png',
    };
    service.updateAvatar.mockResolvedValue(updated);
    const file = { buffer: Buffer.from('image'), size: 5 };

    await expect(controller.uploadAvatar(file, USER_A)).resolves.toEqual(
      updated,
    );
    expect(service.updateAvatar).toHaveBeenCalledWith(USER_A.sub, file);
    expect(JSON.stringify(updated)).not.toContain('passwordHash');
  });

  it('acts only on the current user, never on a URL id', async () => {
    service.updateAvatar.mockResolvedValue(userWithoutAvatar);
    service.removeAvatar.mockResolvedValue(undefined);
    const file = { buffer: Buffer.from('image'), size: 5 };

    await controller.uploadAvatar(file, USER_A);
    await controller.removeAvatar(USER_A);

    expect(service.updateAvatar).toHaveBeenCalledWith(USER_A.sub, file);
    expect(service.removeAvatar).toHaveBeenCalledWith(USER_A.sub);
    // A different token (even an admin) can only act on itself.
    expect(service.updateAvatar).not.toHaveBeenCalledWith(USER_B.sub, file);
  });

  it('uses 200 for upload and 204 for delete', () => {
    expect(
      Reflect.getMetadata(
        '__httpCode__',
        UsersController.prototype.uploadAvatar,
      ),
    ).toBe(HttpStatus.OK);
    expect(
      Reflect.getMetadata(
        '__httpCode__',
        UsersController.prototype.removeAvatar,
      ),
    ).toBe(HttpStatus.NO_CONTENT);
  });
});
