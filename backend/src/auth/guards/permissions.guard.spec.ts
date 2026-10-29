import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { AnyAuthenticated } from '../decorators/any-authenticated.decorator.js';
import { Public } from '../decorators/public.decorator.js';
import { RequirePermission } from '../decorators/require-permission.decorator.js';
import { PermissionsGuard } from './permissions.guard.js';
import { ROLE_PERMISSIONS } from '../permissions.js';

class TestController {
  @Public()
  open(): void {
    /* public route */
  }

  @AnyAuthenticated()
  ownAccount(): void {
    /* any authenticated route */
  }

  @RequirePermission('users.manage')
  adminOnly(): void {
    /* permission protected route */
  }

  @RequirePermission('stock.read', 'users.manage')
  twoPermissions(): void {
    /* needs both permissions */
  }

  noAccessMetadata(): void {
    /* intentionally undeclared */
  }
}

@RequirePermission('users.manage')
class ClassProtectedController {
  @RequirePermission('stock.read')
  overridden(): void {
    /* method metadata wins over class metadata */
  }

  @AnyAuthenticated()
  ownAccountOverride(): void {
    /* explicit any-authenticated wins */
  }

  classProtected(): void {
    /* inherits the class permission */
  }
}

function contextFor(
  handler: () => void,
  controller: new () => unknown,
  user?: { sub: string; role: string },
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PermissionsGuard, Reflector],
    }).compile();

    guard = module.get<PermissionsGuard>(PermissionsGuard);
  });

  it('allows @Public() routes without a user', () => {
    expect(
      guard.canActivate(
        contextFor(TestController.prototype.open, TestController),
      ),
    ).toBe(true);
  });

  it('allows @AnyAuthenticated() routes for any role', () => {
    for (const role of ['ADMIN', 'STAFF', 'SOMETHING_ELSE']) {
      expect(
        guard.canActivate(
          contextFor(TestController.prototype.ownAccount, TestController, {
            sub: 'user-1',
            role,
          }),
        ),
      ).toBe(true);
    }
  });

  it('allows a role that holds the required permission', () => {
    expect(
      guard.canActivate(
        contextFor(TestController.prototype.adminOnly, TestController, {
          sub: 'user-1',
          role: 'ADMIN',
        }),
      ),
    ).toBe(true);
  });

  it('rejects a role missing the required permission (403)', () => {
    expect(() =>
      guard.canActivate(
        contextFor(TestController.prototype.adminOnly, TestController, {
          sub: 'user-2',
          role: 'STAFF',
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('requires every listed permission', () => {
    // STAFF holds stock.read but not users.manage.
    expect(() =>
      guard.canActivate(
        contextFor(TestController.prototype.twoPermissions, TestController, {
          sub: 'user-2',
          role: 'STAFF',
        }),
      ),
    ).toThrow(ForbiddenException);

    expect(
      guard.canActivate(
        contextFor(TestController.prototype.twoPermissions, TestController, {
          sub: 'user-3',
          role: 'ADMIN',
        }),
      ),
    ).toBe(true);
  });

  it('rejects a route with no access metadata (fail closed, 403)', () => {
    expect(() =>
      guard.canActivate(
        contextFor(TestController.prototype.noAccessMetadata, TestController, {
          sub: 'user-1',
          role: 'ADMIN',
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects a permission route without an authenticated user (403)', () => {
    expect(() =>
      guard.canActivate(
        contextFor(TestController.prototype.adminOnly, TestController),
      ),
    ).toThrow(ForbiddenException);
  });

  it('fails closed for an unknown role', () => {
    expect(ROLE_PERMISSIONS['UNKNOWN'] ?? []).toEqual([]);
    expect(() =>
      guard.canActivate(
        contextFor(TestController.prototype.adminOnly, TestController, {
          sub: 'user-1',
          role: 'UNKNOWN',
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('maps CUSTOMER to own-order access and SUPPORT to catalog/order/support-tool access', () => {
    expect(ROLE_PERMISSIONS['CUSTOMER']).toEqual([
      'orders.create_own',
      'orders.read_own',
      'orders.cancel_own',
    ]);
    expect(ROLE_PERMISSIONS['SUPPORT']).toEqual([
      'products.read',
      'categories.read',
      'orders.read_all',
      'orders.cancel_pending',
      'orders.notes.read',
      'orders.notes.write',
      'contact.read',
      'contact.manage',
    ]);

    // SUPPORT may read every order and cancel PENDING ones, but can never
    // confirm or perform any other status change.
    expect(ROLE_PERMISSIONS['SUPPORT']).not.toContain('orders.update_status');
    expect(ROLE_PERMISSIONS['SUPPORT']).not.toContain('orders.create');
    expect(ROLE_PERMISSIONS['SUPPORT']).not.toContain('stock.read');
    expect(ROLE_PERMISSIONS['SUPPORT']).not.toContain('stock.adjust');
    expect(ROLE_PERMISSIONS['SUPPORT']).not.toContain('po.receive');
    // STAFF keeps the till permissions and gets no customer-owned or inbox routes.
    expect(ROLE_PERMISSIONS['STAFF']).not.toContain('orders.create_own');
    expect(ROLE_PERMISSIONS['STAFF']).not.toContain('orders.read_own');
    expect(ROLE_PERMISSIONS['STAFF']).not.toContain('orders.cancel_own');
    expect(ROLE_PERMISSIONS['STAFF']).not.toContain('contact.read');
    expect(ROLE_PERMISSIONS['STAFF']).not.toContain('contact.manage');

    expect(() =>
      guard.canActivate(
        contextFor(TestController.prototype.adminOnly, TestController, {
          sub: 'customer-1',
          role: 'CUSTOMER',
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('lets method-level metadata override class-level metadata', () => {
    // STAFF lacks users.manage (class) but holds stock.read (method).
    expect(
      guard.canActivate(
        contextFor(
          ClassProtectedController.prototype.overridden,
          ClassProtectedController,
          { sub: 'user-2', role: 'STAFF' },
        ),
      ),
    ).toBe(true);

    // The explicit @AnyAuthenticated() method also wins over the class rule.
    expect(
      guard.canActivate(
        contextFor(
          ClassProtectedController.prototype.ownAccountOverride,
          ClassProtectedController,
          { sub: 'user-2', role: 'STAFF' },
        ),
      ),
    ).toBe(true);

    // Without an override the class permission still applies.
    expect(() =>
      guard.canActivate(
        contextFor(
          ClassProtectedController.prototype.classProtected,
          ClassProtectedController,
          { sub: 'user-2', role: 'STAFF' },
        ),
      ),
    ).toThrow(ForbiddenException);
  });
});
