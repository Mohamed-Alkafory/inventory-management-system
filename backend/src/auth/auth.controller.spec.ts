
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;
  const loginFn = vi.fn();
  const refreshFn = vi.fn();
  const logoutFn = vi.fn();

  beforeEach(async () => {
    loginFn.mockReset();
    refreshFn.mockReset();
    logoutFn.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: loginFn,
            refresh: refreshFn,
            logout: logoutFn,
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
});
