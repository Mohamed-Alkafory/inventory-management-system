import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';

import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Public } from '../decorators/public.decorator.js';

class OpenController {
  @Public()
  open(): void {
    /* public route */
  }
}

class SecuredController {
  secured(): void {
    /* protected route */
  }
}

function contextFor(
  handler: () => void,
  request: Record<string, unknown>,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => SecuredController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  const verifyAsync = vi.fn();
  const userFindUnique = vi.fn();

  beforeEach(async () => {
    verifyAsync.mockReset();
    userFindUnique.mockReset();
    userFindUnique.mockResolvedValue({
      id: 'user-1',
      role: 'ADMIN',
      isActive: true,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: JwtService, useValue: { verifyAsync } },
        { provide: PrismaService, useValue: { user: { findUnique: userFindUnique } } },
        Reflector,
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  it('allows @Public() routes without any token', async () => {
    const context = contextFor(OpenController.prototype.open, { headers: {} });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects requests without an Authorization header', async () => {
    const context = contextFor(SecuredController.prototype.secured, {
      headers: {},
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects non-Bearer authorization headers', async () => {
    const context = contextFor(SecuredController.prototype.secured, {
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an invalid or expired token', async () => {
    verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const context = contextFor(SecuredController.prototype.secured, {
      headers: { authorization: 'Bearer bad-token' },
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('loads the user from the database and attaches sub + current role', async () => {
    verifyAsync.mockResolvedValue({ sub: 'user-1', role: 'STAFF' });
    userFindUnique.mockResolvedValue({
      id: 'user-1',
      role: 'ADMIN',
      isActive: true,
    });
    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer good-token' },
    };
    const context = contextFor(SecuredController.prototype.secured, request);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifyAsync).toHaveBeenCalledWith('good-token');
    // The database role wins over the (possibly stale) token claim.
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true, role: true, isActive: true },
    });
    expect(request['user']).toEqual({ sub: 'user-1', role: 'ADMIN' });
  });

  it('rejects a token whose user no longer exists', async () => {
    verifyAsync.mockResolvedValue({ sub: 'ghost', role: 'ADMIN' });
    userFindUnique.mockResolvedValue(null);
    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer ghost-token' },
    };
    const context = contextFor(SecuredController.prototype.secured, request);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token for a deactivated user', async () => {
    verifyAsync.mockResolvedValue({ sub: 'user-1', role: 'ADMIN' });
    userFindUnique.mockResolvedValue({
      id: 'user-1',
      role: 'ADMIN',
      isActive: false,
    });
    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer deactivated-token' },
    };
    const context = contextFor(SecuredController.prototype.secured, request);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
