/**
 * Single source of truth for authorization (fail closed).
 *
 * `ADMIN` is a superset of the other roles; `STAFF` is the operational subset;
 * `SUPPORT` reads products, categories and all orders, cancels PENDING orders
 * only (`orders.cancel_pending`), writes internal order notes and owns the
 * support inbox (`contact.read`, `contact.manage`); `CUSTOMER` can only operate
 * on its own orders (`orders.create_own`, `orders.read_own` and
 * `orders.cancel_own`) plus the `@AnyAuthenticated()` own-account routes.
 * Any role missing from `ROLE_PERMISSIONS` (including an unexpected value
 * from the database) receives no permissions.
 */
export const PERMISSIONS = [
  'products.read',
  'products.write',
  'categories.read',
  'categories.write',
  'suppliers.read',
  'suppliers.write',
  'orders.create',
  'orders.create_own',
  'orders.read_all',
  'orders.read_own',
  'orders.update',
  'orders.update_status',
  'orders.cancel_own',
  'orders.cancel_pending',
  'orders.notes.read',
  'orders.notes.write',
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
  'contact.read',
  'contact.manage',
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
    'orders.cancel_pending',
    'orders.notes.read',
    'orders.notes.write',
    'stock.read',
    'stock.adjust',
    'po.read',
    'po.receive',
  ],
  SUPPORT: [
    'products.read',
    'categories.read',
    'orders.read_all',
    'orders.cancel_pending',
    'orders.notes.read',
    'orders.notes.write',
    'contact.read',
    'contact.manage',
  ],
  CUSTOMER: ['orders.create_own', 'orders.read_own', 'orders.cancel_own'],
};
