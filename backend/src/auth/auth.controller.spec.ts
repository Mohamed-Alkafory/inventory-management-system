import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { IS_PUBLIC_KEY } from './decorators/public.decorator.js';

const USER = {
  sub: '11111111-1111-4111-8111-111111111111',
  role: 'ADMIN',
} as const;

describe('AuthController', () => {
  let controller: AuthController;
  const loginFn = vi.fn();
  const refreshFn = vi.fn();
  const logoutFn = vi.fn();
  const meFn = vi.fn();
  const updateMeFn = vi.fn();
  const changePasswordFn = vi.fn();

  beforeEach(async () => {
    loginFn.mockReset();
    refreshFn.mockReset();
    logoutFn.mockReset();
    meFn.mockReset();
    updateMeFn.mockReset();
    changePasswordFn.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: loginFn,
            refresh: refreshFn,
            logout: logoutFn,
            me: meFn,
            updateMe: updateMeFn,
            changePassword: changePasswordFn,
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates login to the auth service', async () => {
    const dto = { email: 'admin@example.com', password: 'Admin123!' };
    loginFn.mockResolvedValue({ accessToken: 'a' });

    await expect(controller.login(dto)).resolves.toEqual({ accessToken: 'a' });
    expect(loginFn).toHaveBeenCalledWith(dto);
  });

  it('delegates refresh to the auth service', async () => {
    const dto = { refreshToken: 'r'.repeat(64) };
    refreshFn.mockResolvedValue({ accessToken: 'a', refreshToken: 'b' });

    await expect(controller.refresh(dto)).resolves.toEqual({
      accessToken: 'a',
      refreshToken: 'b',
    });
    expect(refreshFn).toHaveBeenCalledWith(dto);
  });

  it('delegates logout to the auth service', async () => {
    const dto = { refreshToken: 'r'.repeat(64) };
    logoutFn.mockResolvedValue(undefined);

    await expect(controller.logout(dto)).resolves.toBeUndefined();
    expect(logoutFn).toHaveBeenCalledWith(dto);
  });

  it('loads the profile of the current user (#54)', async () => {
    const profile = { id: USER.sub, name: 'Admin', email: 'a@example.com' };
    meFn.mockResolvedValue(profile);

    await expect(controller.getMe(USER)).resolves.toEqual(profile);
    expect(meFn).toHaveBeenCalledWith(USER.sub);
  });

  it('updates the current profile (#54)', async () => {
    const dto = { name: 'Renamed' };
    updateMeFn.mockResolvedValue({ id: USER.sub, name: 'Renamed' });

    await expect(controller.updateMe(USER, dto)).resolves.toEqual({
      id: USER.sub,
      name: 'Renamed',
    });
    expect(updateMeFn).toHaveBeenCalledWith(USER.sub, dto);
  });

  it('changes the password of the current user (#54)', async () => {
    const dto = { currentPassword: 'Admin123!', newPassword: 'NewPass123!' };
    changePasswordFn.mockResolvedValue(undefined);

    await expect(controller.changePassword(USER, dto)).resolves.toBeUndefined();
    expect(changePasswordFn).toHaveBeenCalledWith(USER.sub, dto);
  });

  it('requires authentication on all three profile routes (no @Public)', () => {
    for (const handler of [
      AuthController.prototype.getMe,
      AuthController.prototype.updateMe,
      AuthController.prototype.changePassword,
    ]) {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBeUndefined();
    }
  });

  describe('input validation (400)', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const profile = (value: unknown) =>
      pipe.transform(value, { type: 'body', metatype: UpdateProfileDto });
    const password = (value: unknown) =>
      pipe.transform(value, { type: 'body', metatype: ChangePasswordDto });

    it('accepts a valid profile update and the nested password form', async () => {
      await expect(profile({ name: 'Renamed' })).resolves.toMatchObject({
        name: 'Renamed',
      });
      await expect(
        profile({ password: { current: 'Admin123!', next: 'NewPass123!' } }),
      ).resolves.toMatchObject({
        password: { current: 'Admin123!', next: 'NewPass123!' },
      });
    });

    it.each([
      ['a too-short name', { name: 'A' }],
      ['an empty password object', { password: {} }],
      [
        'a short next password',
        { password: { current: 'Admin123!', next: 'short' } },
      ],
      [
        'an over-72-byte next password',
        { password: { current: 'Admin123!', next: 'a'.repeat(73) } },
      ],
      ['a non-editable field', { role: 'ADMIN' }],
      ['a non-editable email', { email: 'new@example.com' }],
    ] as const)('rejects %s on PATCH /auth/me', async (_name, bad) => {
      await expect(profile(bad)).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each([
      ['a missing currentPassword', { newPassword: 'NewPass123!' }],
      [
        'a short newPassword',
        { currentPassword: 'Admin123!', newPassword: 'short' },
      ],
      [
        'an over-72-byte newPassword',
        { currentPassword: 'Admin123!', newPassword: 'a'.repeat(73) },
      ],
      [
        'an unknown field',
        {
          currentPassword: 'Admin123!',
          newPassword: 'NewPass123!',
          role: 'ADMIN',
        },
      ],
    ] as const)(
      'rejects %s on POST /auth/change-password',
      async (_name, bad) => {
        await expect(password(bad)).rejects.toBeInstanceOf(BadRequestException);
      },
    );

    it('accepts a valid change-password body', async () => {
      await expect(
        password({ currentPassword: 'Admin123!', newPassword: 'NewPass123!' }),
      ).resolves.toMatchObject({ currentPassword: 'Admin123!' });
    });
  });
});
