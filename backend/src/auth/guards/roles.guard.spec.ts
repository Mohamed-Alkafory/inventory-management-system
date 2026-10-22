import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from './roles.guard.js';
import { Roles } from '../decorators/roles.decorator.js';

class AdminRoute {
  @Roles('ADMIN')
  adminOnly(): void {
    /* admin-only route */
  }

  anyAuthenticated(): void {
    /* any authenticated route */
  }
}

function contextFor(
  handler: () => void,
  user?: { sub: string; role: string },
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => AdminRoute,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesGuard, Reflector],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
  });

  it('allows routes without @Roles() regardless of role', () => {
    const context = contextFor(AdminRoute.prototype.anyAuthenticated);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows @Roles("ADMIN") when the user is an ADMIN', () => {
    const context = contextFor(AdminRoute.prototype.adminOnly, {
      sub: 'user-1',
      role: 'ADMIN',
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects @Roles("ADMIN") when the user is a STAFF (403)', () => {
    const context = contextFor(AdminRoute.prototype.adminOnly, {
      sub: 'user-2',
      role: 'STAFF',
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects @Roles("ADMIN") when there is no authenticated user (403)', () => {
    const context = contextFor(AdminRoute.prototype.adminOnly, undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
