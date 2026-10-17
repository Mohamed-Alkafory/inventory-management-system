# Database Schema — Inventory Management System

Source of truth: `backend/prisma/schema.prisma` (Prisma 7.9.1, PostgreSQL provider).
Initial migration: `backend/prisma/migrations/20251015000000_init/migration.sql`.
Prisma config: `backend/prisma.config.ts` (`schema`, `migrations.path`, datasource URL from `DATABASE_URL`).

## Connection

- PostgreSQL 16 via Docker Compose service `db` (`docker-compose.yml`), data in the `pgdata` volume, database `inventory_db`. The container maps to host port `5432` by default; `POSTGRES_PORT` in the repo-root `.env` overrides it.
- The backend connects with `DATABASE_URL` (see `backend/.env.example`). Local development on this machine currently maps the container to host port `5433` because a native Windows PostgreSQL occupies `5432`.

## Conventions

- Primary keys are UUIDs (`UUID`, `uuid()` default), e.g. `categories.id`.
- Money fields are `DECIMAL(12,2)` (`price`, `cost_price`, `unit_price`, `line_total`, `total_amount`, `unit_cost`).
- Timestamps are `TIMESTAMPTZ(6)`; `created_at` defaults to `CURRENT_TIMESTAMP`, `updated_at` is managed by Prisma `@updatedAt`.
- Prisma model/field names are camelCase; database tables/columns are snake_case via `@@map`/`@map` (e.g. `OrderItem` → `order_items`, `createdById` → `created_by_id`).
- Deletion policy default: `RESTRICT` on business references (category, supplier, product, order links) so referenced rows cannot be deleted; `CASCADE` from parent aggregates (`Order` → `OrderItem`, `PurchaseOrder` → `PurchaseOrderItem`, `User` → notifications/tokens); `SET NULL` for `AuditLog.user` so logs survive user deletion.

## Enums

| Enum                  | Values                                                                               |
| --------------------- | ------------------------------------------------------------------------------------ |
| `UserRole`            | `ADMIN`, `STAFF` (`users.role` defaults to `STAFF`)                                  |
| `OrderStatus`         | `PENDING` (default), `CONFIRMED`, `CANCELLED`                                        |
| `StockMovementType`   | `PURCHASE_RECEIPT`, `SALE`, `RETURN`, `ADJUSTMENT`                                   |
| `PurchaseOrderStatus` | `DRAFT` (default), `ORDERED`, `PARTIALLY_RECEIVED`, `RECEIVED`, `CANCELLED`          |
| `NotificationType`    | `LOW_STOCK`, `ORDER_CREATED`, `ORDER_CANCELLED`, `PURCHASE_ORDER_RECEIVED`, `SYSTEM` |

## Tables

### `categories`

`id`, `name` (unique), `description?`, `is_active` (default true), `created_at`, `updated_at`. Has many `products`.

### `products`

`id`, `sku` (unique), `name`, `description?`, `image_url?`, `barcode?` (unique), `price`, `cost_price?`, `quantity` (default 0), `min_stock` (default 0), `is_active` (default true), `category_id` (required), `supplier_id?`, `created_at`, `updated_at`. Belongs to `Category` (`Restrict/Cascade`) and optionally `Supplier` (`Restrict/Cascade`).

### `suppliers`

`id`, `company_name`, `email?`, `phone?`, `address?`, `is_active` (default true), `created_at`, `updated_at`. Has many `products` and `purchase_orders`.

### `users`

`id`, `name`, `email` (unique), `password_hash`, `role` (default `STAFF`), `is_active` (default true), `created_at`, `updated_at`. Has many `orders` (created), `stock_movements` (created), `purchase_orders` (created), `notifications`, `notification_preferences`, `audit_logs`, `refresh_tokens`.

### `orders`

`id`, `order_number` (unique), `status` (default `PENDING`), `customer_name?`, `customer_phone?`, `notes?`, `total_amount`, `created_by_id`, `cancelled_at?`, `created_at`, `updated_at`. Created by `User` (`Restrict`); has many `order_items` and `stock_movements`.

### `order_items`

`id`, `order_id`, `product_id`, `product_name`, `sku`, `quantity`, `unit_price`, `line_total`. `product_name`/`sku`/`unit_price` are point-in-time snapshots copied from the product at order time, so later product edits do not rewrite history. Unique `(order_id, product_id)`. Belongs to `Order` (`Cascade`) and `Product` (`Restrict`).

### `stock_movements`

`id`, `product_id`, `type`, `quantity_change`, `quantity_after`, `reason?`, `order_id?`, `purchase_order_id?`, `created_by_id`, `created_at`. Links to `Product`, creator `User`, and optionally the originating `Order`/`PurchaseOrder` (all `Restrict`).

### `purchase_orders`

`id`, `order_number` (unique), `supplier_id`, `status` (default `DRAFT`), `total_amount`, `expected_at?`, `received_at?`, `notes?`, `created_by_id`, `created_at`, `updated_at`. Belongs to `Supplier` and creator `User` (`Restrict`); has many `items` and `stock_movements`.

### `purchase_order_items`

`id`, `purchase_order_id`, `product_id`, `quantity_ordered`, `quantity_received` (default 0), `unit_cost`. Unique `(purchase_order_id, product_id)`. Belongs to `PurchaseOrder` (`Cascade`) and `Product` (`Restrict`).

### `notifications`

`id`, `user_id`, `type`, `title`, `message`, `entity_type?`, `entity_id?`, `data?` (JSONB), `is_read` (default false), `read_at?`, `created_at`. Belongs to `User` (`Cascade`).

### `notification_preferences`

Composite PK `(user_id, type)`; `enabled` (default true). Belongs to `User` (`Cascade`).

### `audit_logs`

`id`, `user_id?`, `action`, `entity_type`, `entity_id?`, `old_values?`/`new_values?` (JSONB), `created_at`. Belongs to `User?` (`SetNull`).

### `refresh_tokens`

`id`, `user_id`, `token_hash` (unique), `expires_at`, `revoked_at?`, `created_at`. Belongs to `User` (`Cascade`).

## Indexes (beyond primary/unique keys)

- `products`: `(category_id)`, `(supplier_id)`, `(name)`
- `suppliers`: `(company_name)`
- `orders`: `(status, created_at)`, `(created_by_id)`
- `order_items`: `(product_id)`
- `stock_movements`: `(product_id, created_at)`, `(created_by_id)`, `(order_id)`, `(purchase_order_id)`
- `purchase_orders`: `(supplier_id)`, `(status, created_at)`, `(created_by_id)`
- `purchase_order_items`: `(product_id)`
- `notifications`: `(user_id, is_read, created_at)`
- `audit_logs`: `(entity_type, entity_id)`, `(user_id, created_at)`
- `refresh_tokens`: `(user_id)`, `(expires_at)`

## CHECK constraints (`20251015000000_init/migration.sql`, appended after the FKs)

Prisma schema cannot express these; they live in migration SQL only:

- `products`: `price >= 0`, `cost_price IS NULL OR cost_price >= 0`, `quantity >= 0`, `min_stock >= 0`
- `order_items`: `quantity > 0`, `unit_price >= 0`, `line_total >= 0`
- `orders`: `total_amount >= 0`
- `purchase_orders`: `total_amount >= 0`
- `purchase_order_items`: `quantity_ordered > 0`, `quantity_received >= 0`, `quantity_received <= quantity_ordered`, `unit_cost >= 0`
- `stock_movements`: `quantity_change <> 0`, `quantity_after >= 0`

## Key design decisions

1. **Application-enforced stock consistency.** The database guarantees each stock value in isolation (`products.quantity >= 0`, `quantity_change <> 0`, `quantity_after >= 0`) but does _not_ guarantee `quantity_after = previous quantity + quantity_change`, nor that every quantity update has a movement row. Services must update `Product.quantity` and insert the `StockMovement` in one transaction with row locking, computing `quantity_after` server-side.
2. **Order snapshots.** `OrderItem` duplicates product name/SKU/unit price so fulfilled-order history is immutable.
3. **Restrict-by-default deletes.** Business entities cannot be deleted while referenced; only dependent rows (order items, notifications, tokens) cascade, and audit logs keep their rows with the user nulled.
4. **Seed data.** `backend/prisma/seed.ts` (run via `prisma db seed`) inserts deterministic development sample data idempotently. Its credentials (e.g. `admin@example.com / Admin123!`) are for **local development only** — change or remove them before deploying to any shared environment.
