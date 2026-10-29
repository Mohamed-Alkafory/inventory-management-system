/**
 * Single source of truth for authorization (fail closed).
 *
 * `ADMIN` is a superset of `STAFF`; any role missing from `ROLE_PERMISSIONS`
 * (including an unexpected value from the database) receives no permissions.
 */
export const PERMISSIONS = [
  'products.read',
  'products.write',
  'categories.read',
  'categories.write',
  'suppliers.read',
  'suppliers.write',
  'orders.create',
  'orders.read_all',
  'orders.update',
  'orders.update_status',
  'stock.read',
  'stock.adjust',
  'po.read',
  'po.create',
  'po.update_status',
  'po.receive',
  'users.manage',
  'dashboard.read',
  'reports.read',
  'audit.read',
  'auth.admin_only',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Every permission available to a role. Unknown roles resolve to `[]`. */
export const ROLE_PERMISSIONS: Readonly<
  Record<string, readonly Permission[]>
> = {
  ADMIN: [...PERMISSIONS],
  STAFF: [
    'products.read',
    'categories.read',
    'suppliers.read',
    'orders.create',
    'orders.read_all',
    'orders.update',
    'orders.update_status',
    'stock.read',
    'stock.adjust',
    'po.read',
    'po.receive',
  ],
};
