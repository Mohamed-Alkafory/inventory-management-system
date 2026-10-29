import { SetMetadata } from '@nestjs/common';

import type { Permission } from '../permissions.js';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Require every listed permission. The global `PermissionsGuard` resolves the
 * role from the database user loaded by `JwtAuthGuard`.
 */
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
