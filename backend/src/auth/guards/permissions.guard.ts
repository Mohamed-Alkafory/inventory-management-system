import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { ANY_AUTHENTICATED_KEY } from '../decorators/any-authenticated.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator.js';
import { ROLE_PERMISSIONS, type Permission } from '../permissions.js';

type AuthenticatedRequest = Request & {
  user?: {
    sub: string;
    role: string;
  };
};

/**
 * Global authorization guard (fail closed).
 *
 * Access is granted only when the route is explicitly marked:
 * - `@Public()`
 * - `@AnyAuthenticated()`
 * - `@RequirePermission(...)` and the database role holds every permission
 *
 * A handler with no access metadata is rejected with 403, so forgetting a
 * decorator can never leave an endpoint open to every logged-in user.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    if (
      this.reflector.getAllAndOverride<boolean>(
        ANY_AUTHENTICATED_KEY,
        targets,
      )
    ) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      targets,
    );

    if (!required?.length) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const request =
      context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const granted = user ? (ROLE_PERMISSIONS[user.role] ?? []) : [];

    if (!required.every((permission) => granted.includes(permission))) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
