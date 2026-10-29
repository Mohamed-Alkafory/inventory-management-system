# Decisions — Inventory Management System

> Record of key business decisions. Written down so they don't live only in chat.
> Add new entries at the bottom with date + status. Changing a decision = new entry
> marking the old one superseded, plus an update to `docs/api-contract.md`.

Status legend: **Proposed** → **Accepted** → (optional) **Superseded by AD-xxx**.

---

## AD-001 — Soft delete rules

**Status:** Accepted · **Date:** 2026-10-19

All business entities (`Product`, `Category`, `Supplier`, `User`, `Order`, `PurchaseOrder`) are **soft-deleted**: the API sets `isActive = false` (`is_active`) via the data layer; rows are never removed from the database.

- The database keeps its `RESTRICT` FK policy as **defense in depth**; the API never presses DELETE on a referenced row anyway.
- `DELETE /{resource}/:id` returns `204` and behaves like a deactivate. Filtering lists by `isActive` is the caller's job (`?isActive=true`); deleted records must still resolve by id for history (order items snapshot names, so history stays intact either way).
- **Cascade-dependent rows** (notifications, refresh tokens, order items) may be physically removed by DB cascade per the schema — this is the exception, not the model to copy.
- **Audit logs are never soft-deleted** and survive user deletion (`SetNull`), so an audit trail always remains.
- Consequences: no hard-delete endpoints will be exposed; a future admin purge job (physical cleanup of deactivated rows older than N months) is out of scope for v1 and needs its own decision.

## AD-002 — When stock is deducted (orders)

**Status:** Accepted · **Date:** 2026-10-19

Stock is deducted **at order creation** (status `PENDING`), not at confirmation.

- `POST /orders` validates each item against current `quantity`, then in one transaction: creates the order + items (snapshotting name/sku/unit price), decrements `Product.quantity`, and inserts a `StockMovement` (`type: SALE, quantityChange: -n, quantityAfter` computed server-side). The create fails with `422` if stock is insufficient.
- Later edits do **not** re-sell the same stock — this is deliberate: the shelf clears immediately when a sale is recorded, and pending-but-unconfirmed orders still represent reserved goods in v1's database model (already-verified design: `quantity_change <> 0`, `quantity_after >= 0`).
- **Cancellation (`PENDING` or `CONFIRMED` → `CANCELLED`) fully restores** the stock with one compensating `StockMovement` (`RETURN`, `+n`) and stamps `cancelledAt`. Restoration is whole-order; there is no partial cancel of individual items.
- Consequences: an ORDER that is only ever cancelled will net out to zero stock movement; a confirmed-then-cancelled order creates two movements +n/−n, which the movements list shows as the audit trail.

## AD-003 — Order status transitions

**Status:** Accepted · **Date:** 2026-10-19

```text
PENDING ──confirm──▶ CONFIRMED
   │                    │
   └──────┬───cancel────┘
          ▼
      CANCELLED (terminal, no further transitions)
```

- `confirm` and `cancel` are **dedicated action endpoints** (`POST /orders/:id/confirm`, `POST /orders/:id/cancel`) rather than a generic `PATCH ?status=`, so the transition logic and side-effects live in one place and are impossible to bypass from the body.
- Transitions are validated server-side as a **state machine**: any other transition is a `409 CONFLICT` (state) or `422` (business rule) — never silently ignored.
- Reasons are **required** on `/cancel`. Also applies to purchase orders (`DRAFT|ORDERED → CANCELLED`).
- Reopening/reinstating a `CANCELLED` order is not allowed in v1; the operator creates a fresh one and the audit log preserves what happened.

## AD-004 — Who sees `costPrice`

**Status:** Accepted · **Date:** 2026-10-19

`Product.costPrice` (and `PurchaseOrderItem.unitCost`) is **visible to ADMIN only**.

- STAFF never receive the field in the JSON at all — it is **omitted, not `null`** — so the field's existence/absence is the signal, and STAFF UIs can be built without `costPrice`-awareness.
- The rule is enforced in the serializer layer (per-role response shape), not just by hiding it in the UI.
- Aggregates derived from cost (PO totals, supplier spend) that depend on cost data are also ADMIN-scoped in the API (e.g. `/dashboard/sales-trend` is admin; per-item revenue for STAFF uses the sale `unitPrice`, not cost).
- Consequences: a STAFF role can never accidentally leak cost through the product list/detail; the STAFF product forms simply don't include the field, and any STAFF-originated write attempting to set `costPrice` is `403`.

## AD-005 — Stock writes go through the stock service (idempotent supply chain)

**Status:** Accepted · **Date:** 2026-10-19

Every quantity change — order sale/return, adjustment, purchase receipt, receipt cancel — goes **through one transactional flow** in the stock domain: lock the product row, compute `quantityAfter`, write the movement, update the product.

- Client-sent `quantity`/`quantityAfter` values are ignored (never trusted).
- The DB CHECK constraints (`products.quantity >= 0`, `quantity_change <> 0`, `quantity_after >= 0`) are a safety net, not the enforcement point; the service layer already guarantees them with row locking.
- Consequences: no endpoint other than the stock service may write product quantities, even "conveniently" as part of another route.

## AD-006 — Roles

**Status:** Accepted · **Date:** 2026-10-19

Two roles in v1: `ADMIN` and `STAFF` (no MANAGER/WATCHER). ADMIN is a superset of STAFF. Only ADMIN creates users and manages other users' `role`, `isActive`. Notable STAFF mappings:

- Stock adjustments, orders (CRUD + confirm/cancel), receive POs, notifications — **STAFF**.
- Users, categories, suppliers, products (write), PO creation/confirm/cancel, audit logs, sales trend — **ADMIN**.

A finer-grained permission matrix is out of scope for v1; revisit if a third role is ever needed.

**Amended by AD-016:** the role set is now `ADMIN`, `STAFF`, `SUPPORT` and `CUSTOMER`; the permission matrix in AD-015 still defines ADMIN/STAFF and AD-016 adds the new roles.

## AD-007 — Notifications are a best-effort, ADMIN-directed side effect (issue #31)

**Status:** Accepted · **Date:** 2026-10-24

Stock/order/purchase-order flows call the notifications service **after their transaction commits**, with the main client, never inside the caller's `$transaction` — a notification failure can never abort the main operation (the requirement: "notification creation must never fail the main operation").

- **Recipients:** all active `ADMIN` users (Staff run the till; admins monitor the shop). A user with an explicit `enabled: false` preference for a type stops receiving it — that is what the (previously unused) `NotificationPreference` model is for, so it is **kept and exposed** via `GET/PUT /notifications/preferences` rather than dropped.
- **Same-entity dedupe:** while an unread `LOW_STOCK` notification for a product exists (per recipient), no duplicate is created; reading it re-arms future alerts.
- **`entityType`/`entityId`** always point at the product/order/purchase-order so the frontend can deep-link.
- Events wired today: `LOW_STOCK` (stock adjustments + order sales), `ORDER_CREATED`, `ORDER_CANCELLED`, and `PURCHASE_ORDER_RECEIVED` (issue #32).

## AD-008 — Purchase-order permissions and the receive-only stock path (issue #32)

**Status:** Accepted · **Date:** 2026-10-25

`POST /purchase-orders` and `PATCH /purchase-orders/:id/status` are **ADMIN**; `GET` and `POST /:id/receive` are open to **STAFF and ADMIN** (the shop floor receives deliveries). This refines AD-006's PO mapping to match the issue.

- Manual status moves are only `DRAFT → ORDERED` and `DRAFT|ORDERED → CANCELLED`; `PARTIALLY_RECEIVED`/`RECEIVED` are **receiving outcomes only** (a manual `PATCH` targeting them is 409).
- Stock enters the shop **exclusively** through `POST /:id/receive`, one `PURCHASE_RECEIPT` movement per line via the shared stock write (AD-005). A purchase order never moves stock at creation, ordering or cancellation.
- Receiving is all-or-nothing: `quantityReceived`, product quantity, movements, status and `receivedAt` change in ONE Serializable transaction; over-receiving is 409.
- `unitCost` is client input (supplier pricing); `totalAmount` is server-computed. `orderNumber` is `PO-####` from the row count, retried once on a P2002 race.

## AD-009 — Dashboard is ADMIN-only and values stock at cost (issue #33)

**Status:** Accepted · **Date:** 2026-10-25

All `/dashboard/*` routes are **ADMIN-only** (`@RequirePermission('dashboard.read')`; originally `@Roles('ADMIN')`, superseded by AD-015). The payloads expose revenue and cost-basis stock value, which AD-004 keeps off STAFF screens; a separate STAFF view is deliberately not provided in v1.

- **Stock value basis:** `SUM(quantity * costPrice)` over **active** products, with a NULL `costPrice` counting as 0. The price-based alternative (`quantity * price`) would overstate inventory worth; cost matches what the shop actually invested. The docs and Swagger say so explicitly.
- **Counts** (`totalProducts`, `totalStockUnits`, `lowStockCount`, `outOfStockCount`) cover active products only.
- **Revenue/sales/top-products** exclude `CANCELLED` orders and include `PENDING` + `CONFIRMED` (stock leaves at creation — AD-002), so figures agree with the movement history.
- **Ranges:** optional `from`/`to` (both or neither; default last 30 days; `from <= to`; at most **92 days**) — violations are 400. Day buckets are UTC and every day in the range is present (zero-filled), so charts never need gap handling.
- **Query choice:** Prisma `aggregate`/`groupBy`/`count` first; `$queryRaw` only for what Prisma cannot express — the two column-math expressions and UTC `date_trunc` grouping — always parameterized with no string interpolation of user input.

## AD-010 — Audit logging is best effort, redacted and transactional where possible (issue #34)

**Status:** Accepted · **Date:** 2026-10-25

`AuditService.log(entry, tx?)` is the single write path. `GET /audit-logs` is **ADMIN-only**, paginated and filtered; the trail is **read-only** — there is no API route to edit or delete entries.

- **Never breaks the main operation:** `log()` catches every failure and emits a warning; the mutation still succeeds. Callers that already own a transaction pass it in, so the entry commits/rolls back with the change (stock adjustments, order create/cancel, PO receipt, user updates run inside their existing transactions; product writes log after the row write).
- **No secrets:** before persisting, both payloads are recursively sanitized — any key matching `password`/`hash`/`token`/`secret` (case-insensitive) is dropped at every depth. `passwordHash` and refresh tokens therefore can never be stored. Dates are ISO strings, Decimals strings, bigints strings; absent payloads are SQL `NULL`.
- **Action vocabulary:** `product.created|updated|deleted`, `stock.adjusted` (entity `stock_movement`), `order.created|cancelled`, `purchase_order.received` (`entityType: 'purchase_order'`), `user.updated|deactivated`. Product updates store the full before/after snapshot, so price changes are visible. Category/supplier mutations are out of scope for this issue.
- **Filters:** exact `userId`/`entityType`/`entityId`/`action`, inclusive `from`/`to` on `createdAt`, `sortBy=createdAt|action`, `sortOrder=asc|desc` (default `createdAt desc`, stable `id` tiebreak).

## AD-011 — Self-service profile and password changes (issue #54)

**Status:** Accepted · **Date:** 2026-10-25

`GET /auth/me`, `PATCH /auth/me` and `POST /auth/change-password` are authenticated (no `@Public`) and operate **only on the caller's own account** — the id always comes from the JWT, never from the body or path.

- **Editable fields:** `name` and `password` only. `role`, `email` and `isActive` remain ADMIN-managed through `/users`; the global whitelist pipe rejects them with 400 rather than silently ignoring them.
- **Password verification:** the current password is checked before any write; a mismatch answers **422** (authenticated request, invalid input) and touches nothing.
- **Storage:** `next`/`newPassword` (8–72 bytes) is bcrypt-hashed with the same 10 rounds as account creation; plaintext is never stored or logged — conflict with AD-010's redaction is impossible because the audit entry contains no password fields.
- **Session invalidation:** a successful password change revokes **all** active refresh tokens for that user in the same transaction (the user row update, revocation and audit entry commit together). The current 15-minute access token stays valid until it expires.
- **Audit:** `user.password_changed` for password updates (with `refreshTokensRevoked` count, no credentials); `user.updated` for name-only changes.

## AD-012 — CSV exports are the v1 report surface (issue #55)

**Status:** Accepted · **Date:** 2026-10-25

The dependency "Reports API" did not exist, so this issue defines the report surface itself: four **ADMIN-only CSV downloads** under `/reports` — inventory, low stock, sales for a period, and stock movements.

- **Why CSV-only:** the consumers are spreadsheet/accounting workflows; a JSON twin would duplicate the same queries with no current client. If a JSON report API is ever needed it can reuse `ReportsService` and return the same rows.
- **ADMIN-only:** the inventory export includes `costPrice`, which AD-004 hides from STAFF. Keeping all reports under one role is consistent and avoids a half-restricted surface.
- **Reuse, not reimplementation:** filters mirror `/products`, `/stock/movements` and the dashboard's validated date-range helper (`from`/`to`, default 30 days, 92-day cap → 400). Sales exclude CANCELLED orders, exactly like AD-009.
- **Whole result, no pagination:** a report must be complete; `page`/`limit` are rejected as unknown query params (400) rather than silently ignored.
- **CSV contract:** UTF-8, RFC-4180 (CRLF, doubled quotes, quoted commas/newlines), a header row always present (also for zero rows), and text starting with `= + - @` prefixed with `'` against formula injection. Filenames are `attachment` with a report-specific, date-stamped name.
- `low_stock` is expressed with a Prisma field reference (`quantity: { lte: prisma.product.fields.minStock }`), not raw SQL.

## AD-013 — Product images are uploaded files, publicly served (issue: product image upload)

**Status:** Accepted — **Date:** 2026-10-28

Product images can be uploaded through `POST /products/:id/image` (ADMIN only, multipart field `image`) and removed through `DELETE /products/:id/image` (ADMIN only, `204`).

- **Validation:** real content is checked with magic bytes (`file-type`), not the client MIME type or extension. Only JPEG, PNG and WebP are accepted; the maximum size is **2 MB**. Rejected files answer `400` (type/missing file) or `413` (size).
- **Storage:** local disk under `UPLOADS_DIR` (default `./uploads`), in `uploads/products/`. Filenames are generated UUIDs with the detected extension; the client filename is never used. The database stores only the relative public path, `/uploads/products/<uuid>.<ext>`.
- **Compatibility:** `Product.imageUrl` remains an optional string. Existing external `https://...` URLs keep working and are never deleted from disk; replacement/deletion only removes files under `/uploads/products/`.
- **Public access:** uploaded files are served statically at `/uploads` (outside `/api/v1`) without a JWT, so catalogue images work on the public storefront. Helmet's `crossOriginResourcePolicy` is set to `cross-origin` for that reason; all other Helmet defaults remain.
- **Consistency:** missing products answer `404`; inactive (soft-deleted) products follow the existing update behaviour and still resolve by id. A failed database update removes the just-written file (no orphans). The audit vocabulary gains `product.image_updated` and `product.image_deleted` (no file contents).

## AD-014 — User avatars are public files with a 1 MB limit (issue: profile avatar upload)

**Status:** Accepted — **Date:** 2026-10-29

Authenticated users can upload/replace their own avatar through `POST /users/me/avatar` (multipart field `image`) and remove it through `DELETE /users/me/avatar` (`204`).

- **Current user only:** the id always comes from the JWT, never from a path or body parameter. Admins therefore cannot change another user's avatar through these routes.
- **Validation:** real content is checked with magic bytes, not the client MIME type or filename. JPEG, PNG and WebP are accepted; the maximum size is **1 MB** (rejected with `413`), and `400` covers missing/unsupported files.
- **Storage:** files are stored by the shared `ImageStorageService` under `UPLOADS_DIR/avatars/` (`UPLOADS_DIR` defaults to `./uploads`) with generated UUID names. `User.avatarUrl` stores only the relative public path or `null`. The same service handles product images, so storage can move to an external object store before deployment without changing either feature.
- **Public access:** avatars are served statically at `/uploads` (outside `/api/v1`) without a JWT, because an `<img>` tag cannot send an `Authorization` header. The files are intentionally public; only the upload/delete operations are authenticated.
- **Consistency:** replacement deletes the previous local file after the DB update, and a failed DB update removes the newly written file. External avatar URLs are never deleted from disk. The audit vocabulary gains `user.avatar_updated` and `user.avatar_deleted` (no file contents).

## AD-015 — Authorization is deny-by-default with a permission map

**Status:** Accepted — **Date:** 2026-10-29

`RolesGuard` is replaced by a global `PermissionsGuard` in the same position (`ThrottlerGuard` → `JwtAuthGuard` → `PermissionsGuard`). Every route must declare exactly one access mode: `@Public()`, `@AnyAuthenticated()`, or `@RequirePermission(...)`. A handler with no access metadata is rejected with `403 FORBIDDEN` in the standard error shape, so a forgotten decorator can no longer leave an endpoint open to every logged-in user.

- **Source of truth:** `backend/src/auth/permissions.ts` defines `Permission` and `ROLE_PERMISSIONS`. `ADMIN` holds every permission; `STAFF` holds the operational subset below. Any role missing from the map (including an unexpected database value) holds no permissions.
- **Evaluation:** the role comes from the database user loaded by `JwtAuthGuard`, never from the token claim. `@RequirePermission` requires **all** listed permissions. Method metadata overrides class metadata via `getAllAndOverride`.
- **Own-account routes** are `@AnyAuthenticated()`: `GET/PATCH/DELETE /auth/me`, `POST /auth/change-password`, `POST /auth/logout`, `POST/DELETE /users/me/avatar`, and all `/notifications` routes (ownership is enforced in the service).
- **Public routes:** `POST /auth/login`, `POST /auth/register`, `POST /auth/refresh`, `GET /health`, and the read-only `GET /catalog/products`, `GET /catalog/products/:id`, `GET /catalog/categories` (AD-018).

| Permission | ADMIN | STAFF | Routes |
| --- | --- | --- | --- |
| `products.read` | yes | yes | `GET /products`, `GET /products/:id` |
| `products.write` | yes | no | `POST/PATCH/DELETE /products`, `POST/DELETE /products/:id/image` |
| `categories.read` | yes | yes | `GET /categories`, `GET /categories/:id` |
| `categories.write` | yes | no | `POST/PATCH/DELETE /categories` |
| `suppliers.read` | yes | yes | `GET /suppliers`, `GET /suppliers/:id` |
| `suppliers.write` | yes | no | `POST/PATCH/DELETE /suppliers` |
| `orders.create` | yes | yes | `POST /orders` |
| `orders.read_all` | yes | yes | `GET /orders`, `GET /orders/:id` |
| `orders.update` | yes | yes | `PATCH /orders/:id` |
| `orders.update_status` | yes | yes | `PATCH /orders/:id/status` |
| `stock.read` | yes | yes | `GET /stock/movements`, `GET /stock/low-stock`, `GET /products/:id/movements` |
| `stock.adjust` | yes | yes | `POST /stock/adjustments` |
| `po.read` | yes | yes | `GET /purchase-orders`, `GET /purchase-orders/:id` |
| `po.create` | yes | no | `POST /purchase-orders` |
| `po.update_status` | yes | no | `PATCH /purchase-orders/:id/status` |
| `po.receive` | yes | yes | `POST /purchase-orders/:id/receive` |
| `users.manage` | yes | no | `GET/POST /users`, `GET/PATCH/DELETE /users/:id` |
| `dashboard.read` | yes | no | all `/dashboard/*` |
| `reports.read` | yes | no | all `/reports/*` |
| `audit.read` | yes | no | `GET /audit-logs` |
| `auth.admin_only` | yes | no | `GET /auth/admin-only` |

This preserves the existing role split (AD-006, AD-008, AD-009) while making the 403 boundary explicit and testable. `costPrice` remains ADMIN-only in product responses (AD-004) independently of `products.read`.

## AD-016 — CUSTOMER and SUPPORT roles

**Status:** Accepted — **Date:** 2026-10-29

The `UserRole` enum now has four values: `ADMIN`, `STAFF`, `SUPPORT` and `CUSTOMER` (additive migration `20261029010000_add_customer_support_roles`). ADMIN remains a superset of every other role; STAFF keeps the operational permissions from AD-015.

- **CUSTOMER** has no business permissions (`ROLE_PERMISSIONS.CUSTOMER = []`). A customer can only use `@AnyAuthenticated()` own-account routes: `GET/PATCH/DELETE /auth/me`, `POST /auth/change-password`, `POST /auth/logout`, `POST/DELETE /users/me/avatar` and the `/notifications` routes (ownership is enforced in the service). Later issues extend this role.
- **SUPPORT** is read-only today and holds exactly `products.read` and `categories.read` (plus the same own-account routes). It cannot adjust stock, manage orders, receive purchase orders, or see cost data.
- **Registration:** public `POST /auth/register` always creates a `CUSTOMER`. The DTO has no `role` field, and the global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`) rejects a client-supplied `role` with `400`.
- **User management:** only `users.manage` (ADMIN) can create or update users. `CreateUserDto.role` and `UpdateUserDto.role` use `@IsEnum(UserRole)`, so an unknown role is a `400`.
- **Last-admin safety:** an operation that would leave zero active ADMINs is rejected with `409 CONFLICT` (`At least one active ADMIN must remain`). This covers admin-managed updates/deactivation and self-deactivation via `DELETE /auth/me`. The count and write share one transaction and the users API uses Serializable isolation with one `P2034` retry. Self-role-change and self-deactivation through `/users/:id` remain `422` when another active admin exists.
- **Session invalidation:** changing a user's role, deactivating a user (by an admin or via `DELETE /auth/me`) and changing a password all revoke every active refresh token (`revokedAt`). Re-activating an account or renaming it does not.

| Permission | ADMIN | STAFF | SUPPORT | CUSTOMER |
| --- | --- | --- | --- | --- |
| `products.read` | yes | yes | yes | no |
| `categories.read` | yes | yes | yes | no |
| all other permissions (AD-015) | yes | STAFF subset | no | no |
| `@AnyAuthenticated()` own-account routes | yes | yes | yes | yes |

## AD-017 — CUSTOMER-owned orders and shipping details

**Status:** Accepted — **Date:** 2026-10-30

Customers can now place and manage their own orders without touching the staff till contract. The database change is one additive migration (`20261030000000_add_customer_orders`): `orders.customer_id` (nullable FK to `users`, `ON DELETE SET NULL`), `recipient_name`, `recipient_phone`, `shipping_address`, `shipping_city`, a `PaymentMethod` enum with only `COD` and `payment_method` defaulting to `COD`, plus the `(customer_id, created_at)` index. Existing rows stay valid because every new column except `payment_method` is nullable and `payment_method` has a default.

- **Explicit relations:** `Order.createdBy`/`User.createdOrders` and `Order.customer`/`User.customerOrders` are named relations, so the two user links cannot be confused by Prisma or by a future migration.
- **Permissions:** three new permissions keep ownership routes separate from staff routes: `orders.create_own`, `orders.read_own`, `orders.cancel_own`. CUSTOMER holds exactly those; ADMIN remains a superset and therefore also holds them. STAFF keeps the till permissions (`orders.create`, `orders.read_all`, `orders.update`, `orders.update_status`) and gains none of the own-order permissions. SUPPORT gains `orders.read_all` only, so it can read every order but can never create, edit, confirm or cancel one.
- **Shared creation transaction:** `POST /orders/mine` and `POST /orders` both call the same private creation pipeline (`createOrderRecord`): duplicate-line validation, one Serializable transaction, server-side decimal pricing, one atomic guarded decrement and `SALE` movement per line, sequential `orderNumber`, audit entry and best-effort admin/low-stock notifications. The customer path only adds `customerId`, recipient/shipping fields and copies the recipient into `customerName`/`customerPhone` so existing staff screens keep rendering. The staff endpoint's behaviour and body are unchanged.
- **Ownership semantics:** `GET /orders/mine` always filters `customerId = token user`; `GET /orders/mine/:id` and `POST /orders/mine/:id/cancel` use `findFirst`/conditional writes scoped to the owner. A missing order and a foreign order are indistinguishable (`404`, never `403`) so ownership cannot be probed through status codes.
- **Cancellation:** the customer cancel reuses the staff status-transition transaction with an ownership scope. Only `PENDING` orders can be cancelled; `CONFIRMED`/`CANCELLED` and same-status writes are `409`. The status-conditional `updateMany` (also scoped to `customerId`) is the race backstop, so a double cancel can never restore stock twice, and `P2034`/`P2002` retries keep the existing concurrency safety.
- **Response allow-list:** customer responses are built by an explicit serializer, not by spreading a Prisma row: `{ id, orderNumber, status, totalAmount, items: [{ productName, sku, quantity, unitPrice, lineTotal }], recipientName, recipientPhone, shippingAddress, shippingCity, paymentMethod, createdAt, cancelledAt }`. `createdById`, `customerId`, notes, `createdBy`, stock movements and audit data are never exposed.
- **Abuse limits:** `POST /orders/mine` accepts 1–30 distinct products, 1–50 per line, active products only, and is throttled to 10 requests per minute per client. Unknown body properties (including `price`, `status`, `customerId`, `createdById`) are rejected with `400` by the global ValidationPipe.
- **Known follow-up:** the frontend checkout still posts to `POST /orders`; it must be moved to `POST /orders/mine` in a frontend issue (not changed here).

## AD-018 — Public, safe storefront catalog

**Status:** Accepted — **Date:** 2026-10-30

Anonymous visitors can browse products and categories through `GET /catalog/products`, `GET /catalog/products/:id` and `GET /catalog/categories`. No schema change is needed, and the authenticated `/products` and `/categories` endpoints are unchanged.

- **Public only for reading:** the three catalog handlers use `@Public()`; the global `JwtAuthGuard` skips them while `ThrottlerGuard` still runs. Every other route keeps its deny-by-default permission metadata (AD-015).
- **Explicit allow-list:** products are read with a dedicated Prisma `select` (including only `category { id, name }`) and serialized field by field. The public product shape is `{ id, sku, name, description, price, imageUrl, category: { id, name }, inStock, maxOrderable }`. `costPrice`, `minStock`, exact `quantity`, `barcode`, `supplier`, `isActive`, `categoryId` and all timestamps are never selected into the response.
- **SKU decision:** `sku` **is** returned because it is already customer-visible in the customer-safe own-order items (`GET /orders/mine`) and in the storefront cart/product UI. It contains no cost, stock, supplier or internal-state information. The other internal identifiers remain hidden.
- **Availability:** only `isActive = true` products whose category is also `isActive = true` are listed or resolvable. Unknown ids, inactive products and products in inactive categories all answer `404` with the same message, so a hidden product cannot be discovered through status codes. Inactive categories are absent from the category list.
- **Stock disclosure:** the exact quantity is replaced by `inStock` (`quantity > 0`) and `maxOrderable` (`min(quantity, MAX_ORDERABLE_CAP)`), with `MAX_ORDERABLE_CAP = 20` in one named constant. Out-of-stock products report `maxOrderable = 0`.
- **Query contract:** `page`/`limit` (limit max **50**), name-only `search`, `categoryId`, `sort` in `{name, price, newest}` and `order` in `{asc, desc}` are validated by DTOs. `newest` maps to `createdAt`, and every sort has an ascending `id` secondary sort for deterministic pagination. `order` defaults to `desc` for `newest` and `asc` for `name`/`price`.
- **Abuse limit:** all three public routes are throttled to **30 requests per minute per client per route**, stricter than the global private-API default of 100/minute. `429` is returned by the installed `@nestjs/throttler` guard; the limit lives in one exported constant used by every catalog handler.
