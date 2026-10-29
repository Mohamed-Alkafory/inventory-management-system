# API Contract — Inventory Management System

> **Source of truth for all endpoints.** Frontend and backend build against this document.
> Status fields (`status: planned | in-progress | implemented`) track reality — update them
> when a route ships. Data models referenced here mirror `backend/prisma/schema.prisma`
> (see `docs/database-schema.md`).

---

## 1. Conventions

### Base URL

- Dev: `http://localhost:3000/api/v1`
- All paths below are relative to the base URL.
- Version prefix `/api/v1` is mandatory; a future `/api/v2` may coexist.

### JSON casing

- Request **and** response bodies use **camelCase** (`minStock`, `costPrice`, `createdAt`).
- Query parameter names are camelCase too (`?page=1&sortBy=createdAt`).
- No snake_case and no PascalCase in the JSON layer, ever.

### Date & time format

- All timestamps are ISO 8601 strings in **UTC**, e.g. `2026-10-19T14:30:00.000Z`.
- Date-only fields (`expectedAt`, `receivedAt` when sent by the client) also use full
  ISO 8601 timestamps; the client never sends bare `YYYY-MM-DD`.
- The `Z` suffix is always present. No local-timeZONE offsets from the client.

### Money

- Sent as JSON **strings** with 2 decimal places (Prisma `DECIMAL` → string), e.g. `"19.99"`, never floats.

### Authentication

- `Authorization: Bearer <accessToken>` header on every protected endpoint.
- Access tokens are short-lived (15 min); refresh via `POST /auth/refresh`.
- Tokens are **not** stored in cookies by the API; the frontend holds them and attaches the header.
- Public (no auth) endpoints: `POST /auth/login`, `POST /auth/register` (if enabled),
  `POST /auth/refresh`, `GET /health`, `POST /contact`, `GET /catalog/products`,
  `GET /catalog/products/:id`, `GET /catalog/categories`.

### Roles

- Four roles (Prisma `UserRole`): `ADMIN`, `STAFF`, `SUPPORT`, `CUSTOMER`.
- `ADMIN` includes everything the other roles can do. `STAFF` keeps the operational subset from AD-015.
- `SUPPORT` is read-only for shop data: `products.read`, `categories.read` and `orders.read_all` (read every order, but never confirm, cancel or create one), plus the support inbox permissions `contact.read` and `contact.manage`, and the own-account routes.
- `CUSTOMER` can operate on its **own** orders only: `orders.create_own`, `orders.read_own` and `orders.cancel_own` (`POST/GET /orders/mine`, `GET /orders/mine/:id`, `POST /orders/mine/:id/cancel`) plus the own-account routes. Every staff order surface answers `403`.
- Public `POST /auth/register` always creates a `CUSTOMER`; the body has no `role` field and a client-supplied `role` is rejected with `400`. An admin with `users.manage` creates all roles, including `STAFF`, `SUPPORT`, `ADMIN` and `CUSTOMER`, through `/users`.
- "Role required" column below: `any` = any authenticated user; `admin` = the `users.manage` permission (ADMIN only).
- Authorization is **deny-by-default**: each handler must declare `@Public()`, `@AnyAuthenticated()`, or `@RequirePermission(...)`. A handler with none of these answers `403` with the standard `FORBIDDEN` envelope (`{ statusCode: 403, message: "Insufficient permissions", error: "FORBIDDEN", path, timestamp }`), even for an authenticated ADMIN. The full permission map lives in `docs/decisions.md` (AD-015, AD-016).

### Pagination

List endpoints return the envelope:

```json
{
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 143, "totalPages": 8 }
}
```

- Query params: `page` (1-based, default 1), `limit` (default 20, max 100).
- Non-paginated list endpoints (e.g. dropdowns) return a bare array and are marked below.
- Sorting: `sortBy` + `sortOrder` (`asc` | `desc`, default `desc`); allowed `sortBy`
  values are listed per endpoint.

### IDs

- UUID v4 strings everywhere, including in URLs (`/products/:id`).

---

## 2. Standard error response

Every non-2xx response uses this shape:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "VALIDATION_ERROR",
  "fieldErrors": {
    "quantity": ["quantity must be greater than 0"],
    "unitPrice": ["unitPrice must be a positive number"]
  },
  "path": "/api/v1/orders",
  "timestamp": "2026-10-19T14:30:00.000Z"
}
```

| Field         | Type                     | Always present | Notes                                                 |
| ------------- | ------------------------ | -------------- | ----------------------------------------------------- |
| `statusCode`  | number                   | yes            | HTTP status, duplicated in the body                   |
| `message`     | string \| string[]       | yes            | Human-readable summary; arrays allowed (Nest default) |
| `error`       | string                   | yes            | Machine-readable error `CODE` (see table)             |
| `fieldErrors` | Record<string, string[]> | no             | Only for validation errors; maps JSON key → messages  |
| `path`        | string                   | yes            | Request URL                                           |
| `timestamp`   | string                   | yes            | ISO 8601 UTC                                          |

Error codes:

| Code                  | HTTP | Meaning                                                                 |
| --------------------- | ---- | ----------------------------------------------------------------------- |
| `VALIDATION_ERROR`    | 400  | Body/query failed Zod/class-validator checks                            |
| `UNAUTHORIZED`        | 401  | Missing/expired/invalid token                                           |
| `FORBIDDEN`           | 403  | Authenticated but role insufficient                                     |
| `NOT_FOUND`           | 404  | Resource does not exist                                                 |
| `CONFLICT`            | 409  | Duplicate unique field (e.g. SKU, email) or last-admin safety rule      |
| `BUSINESS_RULE_ERROR` | 422  | Semantically invalid (e.g. stock below zero, invalid status transition) |
| `INTERNAL_ERROR`      | 500  | Unexpected server failure                                               |
| `SERVICE_UNAVAILABLE` | 503  | Database or dependency down                                             |

---

## 3. Endpoints

Legend: 🔓 public · Role: `any` / `admin` · Paginated unless marked "no pagination".

### 3.1 Auth

| Method  | Path                    | Role | Request body                            | Response                                    | Errors        |
| ------- | ----------------------- | ---- | --------------------------------------- | ------------------------------------------- | ------------- |
| POST 🔓 | `/auth/login`           | —    | `{ email, password }`                   | `{ user: User, accessToken, refreshToken }` | 400, 401      |
| POST 🔓 | `/auth/register`        | —    | `{ name, email, password }`             | `{ user: User, accessToken, refreshToken }` (201); `user.role` is always `CUSTOMER` | 400, 409 |
| POST 🔓 | `/auth/refresh`         | —    | `{ refreshToken }`                      | `{ accessToken, refreshToken }`             | 400, 401      |
| POST    | `/auth/logout`          | any  | `{ refreshToken }`                      | `204` (empty)                               | 401           |
| GET     | `/auth/me`              | any  | —                                       | `User` (no `passwordHash`)                  | 401           |
| PATCH   | `/auth/me`              | any  | `{ name?, password?{ current, next } }` | `User`                                      | 400, 401, 422 |
| DELETE  | `/auth/me`              | any  | —                                       | `204` (self-deactivation)                   | 401, 409      |
| POST    | `/auth/change-password` | any  | `{ currentPassword, newPassword }`      | `204` (empty)                               | 400, 401, 422 |

`User` shape: `{ id, name, email, avatarUrl, role, isActive, createdAt, updatedAt }` — `passwordHash` is **never** returned by any endpoint. `avatarUrl` is either `null` or a relative `/uploads/avatars/<uuid>.<jpg|png|webp>` path.

- `GET /auth/me` returns the **full** public profile of the authenticated user; a missing/deactivated account answers 401.
- `PATCH /auth/me` only accepts `name` and the nested `password: { current, next }` — `role`, `email` and `isActive` stay ADMIN-managed (`/users`), so sending them is 400.
- Changing a password (either route) verifies `current`/`currentPassword` first: a mismatch is **422** (the request is authenticated, so this is not a 401). `next`/`newPassword` must be 8–72 bytes; it is bcrypt-hashed (rounds 10) and **every active refresh token of the user is revoked**, so other devices must log in again.
- Password changes are audited as `user.password_changed` without any credential material (§3.11).
- `DELETE /auth/me` soft-deactivates the current account and revokes every active refresh token. The last active ADMIN cannot self-deactivate: answers `409 CONFLICT` (`At least one active ADMIN must remain`).

- Public self-registration (`POST /auth/register`) always creates a **CUSTOMER** account. It is the only role a public caller can obtain; privileged roles are provisioned by an ADMIN through `POST /users`.

### 3.2 Users

| Method | Path         | Role  | Request body                               | Response                           | Errors                  |
| ------ | ------------ | ----- | ------------------------------------------ | ---------------------------------- | ----------------------- |
| GET    | `/users`     | admin | `?page&limit&search&role&sortBy&sortOrder` | paginated `User[]`                 | 401, 403                |
| GET    | `/users/:id` | admin | —                                          | `User`                             | 401, 403, 404           |
| POST   | `/users`     | admin | `{ name, email, password, role }` where `role` is `ADMIN`, `STAFF`, `SUPPORT` or `CUSTOMER` | `User` (201)                       | 400, 401, 403, 409      |
| PATCH  | `/users/:id` | admin | `{ name?, email?, role?, isActive? }`      | `User`                             | 400, 403, 404, 409, 422 |
| DELETE | `/users/:id` | admin | —                                          | `204` (soft delete, see decisions) | 401, 403, 404, 409, 422      |
| POST   | `/users/me/avatar`   | any   | `multipart/form-data` with one binary field, `image` (JPEG, PNG or WebP, max 1 MB) | `User` (200) with the new `avatarUrl` | 400 (missing/unsupported image), 401, 413 (too large) |
| DELETE | `/users/me/avatar`   | any   | —                                          | `204` (avatar cleared)             | 401                     |

Avatar endpoints always act on the **authenticated user** (the id comes from the JWT, there is no id in the URL), so even an ADMIN cannot change another user's avatar through them.

- `POST /users/me/avatar` saves a new file, updates `avatarUrl`, then deletes the previous local file. If the database update fails, the new file is deleted so no orphan is left behind.
- `DELETE /users/me/avatar` clears `avatarUrl` and deletes the local file. External `https://...` avatar URLs are never deleted from disk.
- Uploads are **public** (no JWT required) and served outside the `/api/v1` prefix at `/uploads/avatars/<uuid>.<ext>`; the real type is detected from magic bytes, never from the client filename or MIME type.

Errors: `400` for an invalid/unknown role, `409` when deactivating or demoting the last active ADMIN, `422` for self-deactivation / self-role-change. Changing a user's `role` revokes all of their active refresh tokens; deactivating an account revokes them too (as does a password change or self-deactivation).

### 3.3 Categories

| Method | Path              | Role  | Request body                         | Response                                                | Errors                               |
| ------ | ----------------- | ----- | ------------------------------------ | ------------------------------------------------------- | ------------------------------------ |
| GET    | `/categories`     | any   | `?page&limit&search&isActive`        | paginated `Category[]` (active only by default, AD-001) | 400, 401                             |
| GET    | `/categories/:id` | any   | —                                    | `Category` + `productCount`                             | 400 (invalid id), 401, 404           |
| POST   | `/categories`     | admin | `{ name, description? }`             | `Category` (201)                                        | 400, 401, 403, 409                   |
| PATCH  | `/categories/:id` | admin | `{ name?, description?, isActive? }` | `Category`                                              | 400, 401, 403, 404, 409              |
| DELETE | `/categories/:id` | admin | —                                    | `204` (soft delete)                                     | 400 (invalid id), 401, 403, 404, 409 |

`Category`: `{ id, name, description, isActive, createdAt, updatedAt }`.
Errors: `409` when deleting (or renaming to) a category while another category already uses the name (unique index), or when deleting a category that still has linked products — `products.category_id` is FK `ON DELETE RESTRICT`, so the product relation must never be broken (AD-001 soft delete keeps rows).

### 3.4 Products

| Method | Path            | Role  | Request body / query                                                                                                                                 | Response                                       | Errors                                                                      |
| ------ | --------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| GET    | `/products`     | any   | `?page&limit&search&categoryId&supplierId&isActive&stockStatus(in_stock,low_stock,out_of_stock)&sortBy(name,sku,price,quantity,createdAt)&sortOrder` | paginated `Product[]`                          | 400, 401                                                                    |
| GET    | `/products/:id` | any   | —                                                                                                                                                    | `Product` + `{ category, supplier }` populated | 401, 404                                                                    |
| POST   | `/products`     | admin | `{ sku, name, description?, imageUrl?, barcode?, price, costPrice?, quantity?, minStock?, categoryId, supplierId? }`                                 | `Product` (201)                                | 400, 401, 403, 404 (bad categoryId/supplierId), 409 (duplicate sku/barcode) |
| PATCH  | `/products/:id` | admin | same fields, all optional — **`quantity` not directly editable, use `/stock`**                                                                       | `Product`                                      | 400, 401, 403, 404, 409, 422                                                |
| DELETE | `/products/:id` | admin | —                                                                                                                                                    | `204` (soft delete)                            | 401, 403, 404, 422                                                          |
| POST   | `/products/:id/image` | admin | `multipart/form-data` with one binary field, `image` (JPEG, PNG or WebP, max 2 MB) | `Product` (200) with the new `imageUrl`        | 400 (missing/unsupported image), 401, 403, 404, 413 (too large)              |
| DELETE | `/products/:id/image` | admin | —                                                                                                                                                    | `204` (image cleared)                          | 401, 403, 404                                                               |

`Product` shape: `{ id, sku, name, description, imageUrl, barcode, price, costPrice, quantity, minStock, isActive, categoryId, supplierId, createdAt, updatedAt }`.

- `imageUrl` is either an external `https://...` URL or a relative path served by the API: `/uploads/products/<uuid>.<jpg|png|webp>`. Uploads are **public** (no JWT required) and outside the `/api/v1` prefix. The client filename and MIME type are not trusted; the real type is detected from the file's magic bytes.
- `POST /products/:id/image` replaces an existing image and deletes the previous local file; external URLs are never deleted from disk. `DELETE /products/:id/image` clears `imageUrl` and deletes the local file if it is a `/uploads/products/...` path.

- `costPrice` is included **only** for ADMIN (see decisions §4). STAFF responses omit the field entirely (not `null`).
- `stockStatus=low_stock` filters `quantity <= minStock`; `in_stock` → `quantity > 0`;
  `out_of_stock` → `quantity = 0` (drives dashboard + notifications).
  Invalid query values are rejected with `400 VALIDATION_ERROR`.
- Errors: `422` when price/cost validation fails (`price < 0`, `costPrice < 0`), or when deleting a product referenced by an active order/purchase order item.

### 3.5 Suppliers

| Method | Path             | Role  | Request body / query                                    | Response                                                | Errors                          |
| ------ | ---------------- | ----- | ------------------------------------------------------- | ------------------------------------------------------- | ------------------------------- |
| GET    | `/suppliers`     | any   | `?page&limit&search&isActive`                           | paginated `Supplier[]` (active only by default, AD-001) | 400, 401                        |
| GET    | `/suppliers/:id` | any   | —                                                       | `Supplier` + `productCount`                             | 400 (invalid id), 401, 404      |
| POST   | `/suppliers`     | admin | `{ companyName, email?, phone?, address? }`             | `Supplier` (201)                                        | 400, 401, 403                   |
| PATCH  | `/suppliers/:id` | admin | `{ companyName?, email?, phone?, address?, isActive? }` | `Supplier`                                              | 400, 401, 403, 404              |
| DELETE | `/suppliers/:id` | admin | —                                                       | `204` (soft delete)                                     | 400 (invalid id), 401, 403, 404 |

`Supplier`: `{ id, companyName, email, phone, address, isActive, createdAt, updatedAt }`.
Soft delete (AD-001): rows are never removed, so linked `products` and `purchase_orders` (FK `ON DELETE RESTRICT`) keep their references intact; deactivation only drops the supplier from the default listing.

### 3.6 Stock

| Method | Path                      | Role | Request body / query                                                          | Response                                                    | Errors                           |
| ------ | ------------------------- | ---- | ----------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------- |
| GET    | `/stock/movements`        | any  | `?page&limit&productId&type&orderId&purchaseOrderId&from&to&sortBy&sortOrder` | paginated `StockMovement[]`                                 | 400, 401                         |
| GET    | `/products/:id/movements` | any  | `?page&limit&type&orderId&purchaseOrderId&from&to&sortBy&sortOrder`           | paginated `StockMovement[]` (forced to the path product)    | 400 (invalid id/query), 401, 404 |
| POST   | `/stock/adjustments`      | any  | `{ productId, quantityChange, reason }` (quantityChange ≠ 0)                  | `{ movement: StockMovement, product: Product }` (201)       | 400, 401, 404, 409, 422          |
| GET    | `/stock/low-stock`        | any  | `?page&limit`                                                                 | paginated `Product[]` (`quantity <= minStock`, active only) | 400, 401                         |

- `StockMovement` shape: `{ id, productId, type, quantityChange, quantityAfter, reason, orderId, purchaseOrderId, createdById, createdAt }`.
- `type` on adjustments is always `ADJUSTMENT`; `SALE`/`PURCHASE_RECEIPT`/`RETURN` are system-generated from orders/purchase orders.
- Role: STAFF may adjust stock (they run the till); `RETURN` and other system types cannot be created manually.
- Errors: `409` when the quantity would go below zero (atomic guard, issue-specified); `422` when the product is inactive; `quantityChange = 0` is a `400` field error. The write is one conditional atomic `updateMany` (quantity guard + `increment`) inside a Serializable transaction, so two concurrent decreases can never push the quantity below zero.
- Product quantity and the movement row are written in **one transaction** (`quantityAfter` computed server-side, never sent by client).

### 3.7 Orders

| Method | Path                         | Role                 | Request body / query                                                                                                                                  | Response                          | Errors                                                                 |
| ------ | ---------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------- |
| GET    | `/orders`                    | STAFF, ADMIN, SUPPORT | `?page&limit&status&search(customerName,orderNumber)&createdById&sortBy(status,createdAt)&sortOrder`                                                  | paginated `Order[]`               | 401, 403                                                               |
| GET    | `/orders/:id`                | STAFF, ADMIN, SUPPORT | —                                                                                                                                                     | `Order` + `items[]` + `createdBy` | 401, 403, 404                                                          |
| POST   | `/orders`                    | STAFF, ADMIN         | `type CreateOrderRequest = { items: Array<{ productId: string; quantity: number }>; customerName?: string; customerPhone?: string; notes?: string; }` | `Order` + `items` (201)           | 400, 401, 403, 404 (product not found), 409 (stock), 422 (inactive)    |
| PATCH  | `/orders/:id`                | STAFF, ADMIN         | `{ customerName?, customerPhone?, notes? }` — only while `PENDING`                                                                                    | `Order`                           | 401, 403, 404, 422 (not editable after PENDING)                        |
| PATCH  | `/orders/:id/status`         | STAFF, ADMIN         | `{ newStatus: 'CONFIRMED' \| 'CANCELLED' }`                                                                                                           | `Order` + `items`                 | 400, 401, 403, 404, 409 (invalid transition / double cancel)           |
| POST   | `/orders/mine`               | CUSTOMER             | `{ items: Array<{ productId: string; quantity: number }>; recipientName; recipientPhone; shippingAddress; shippingCity; notes? }`                      | customer-safe `Order` (201)       | 400, 401, 403, 404, 409, 422, 429 (throttle)                           |
| GET    | `/orders/mine`               | CUSTOMER             | `?page&limit&status`                                                                                                                                  | paginated customer-safe `Order[]` | 400, 401, 403                                                          |
| GET    | `/orders/mine/:id`           | CUSTOMER             | —                                                                                                                                                     | customer-safe `Order`             | 400, 401, 403, 404 (missing **or** not owned)                          |
| POST   | `/orders/mine/:id/cancel`    | CUSTOMER             | —                                                                                                                                                     | customer-safe `Order` (201)       | 400, 401, 403, 404 (missing **or** not owned), 409 (not PENDING)       |

> `POST /orders/:id/confirm` and `POST /orders/:id/cancel` from earlier drafts were never implemented; `PATCH /orders/:id/status` replaces them.

- `Order` (staff) shape: `{ id, orderNumber, status, customerName, customerPhone, notes, totalAmount, customerId, recipientName, recipientPhone, shippingAddress, shippingCity, paymentMethod, createdById, cancelledAt, createdAt, updatedAt, items?: OrderItem[] }`.
- `paymentMethod` is the `PaymentMethod` enum (`COD` only today) and defaults to `COD`.
- **Customer-safe `Order` shape** (all `/orders/mine` routes): `{ id, orderNumber, status, totalAmount, items: Array<{ productName, sku, quantity, unitPrice, lineTotal }>, recipientName, recipientPhone, shippingAddress, shippingCity, paymentMethod, createdAt, cancelledAt }`. It never contains `createdById`, `customerId`, `notes`, `createdBy`, stock movements, audit data, item/product ids or any other internal field.
- `POST /orders/mine` accepts 1–30 **distinct** products with `quantity` 1–50 and only active products. The body can never carry `price`, `status`, `customerId` or `createdById` (unknown properties are rejected with `400`). `customerId` and `createdById` are taken from the token, `recipientName`/`recipientPhone` are copied into `customerName`/`customerPhone`, and totals/stock/audit/notifications reuse the same Serializable creation transaction as the staff till. Throttled to 10 requests per minute (`429` beyond that).
- `GET /orders/mine` is paginated (default 20, max 100), newest first, optional `status`, and only returns rows whose `customerId` equals the caller. `GET /orders/mine/:id` answers `404` both for an unknown id and for another customer's order (never `403`). `POST /orders/mine/:id/cancel` only succeeds while the order is `PENDING` and owned; it reuses the staff cancel transaction (stock restored with `RETURN` movements, `cancelledAt` stamped) and a second cancel answers `409` without restoring stock again.
- `GET /orders`: `page` defaults to 1, `limit` defaults to 20 (max 100); default sort is
  `createdAt DESC` with `id ASC` as the deterministic tie-breaker. `status` accepts
  `PENDING | CONFIRMED | CANCELLED`; `search` matches `orderNumber` or `customerName`
  case-insensitively; `createdById` is a UUID. `from` and `to` are inclusive ISO 8601
  bounds on `createdAt`; an invalid date or `from > to` returns 400. Unknown query
  parameters return 400.
- `GET /orders/:id`: returns the order fields plus `items[]` (the API property is
  `items`, not `orderItems`), `createdBy` (`id`, `name`, `email`) and the related
  `stockMovements[]`. A non-UUID id returns 400; a missing order returns 404.
- `OrderItem` shape: `{ id, orderId, productId, productName, sku, quantity, unitPrice, lineTotal }` — snapshots, client must not expect them to track later product edits.
- `totalAmount` is always computed server-side from the item snapshots' `unitPrice`; client-sent prices are ignored.
- **Stock is deducted at `PENDING` creation** and fully restored on cancel (see decisions §2).
- A readable sequential `orderNumber` (`ORD-0001`) is generated server-side from the row count; rows are never removed, so the sequence only grows.
- `POST /orders` runs in **ONE Serializable transaction**: order + item snapshots + one `SALE` movement per line (via the shared stock logic). Any failure rolls everything back — no partial order remains. Conflicting concurrent attempts are retried once, so stock can never drop below zero and the orderNumber cannot collide.
- Errors: `422` when confirming a PENDING order whose stock somehow became unavailable, cancelling a `CONFIRMED` order without permission, or transitioning from a terminal (`CANCELLED`) state.
- Status transitions (issue-specified endpoint): `PENDING → CONFIRMED`, `PENDING → CANCELLED`, `CONFIRMED → CANCELLED` only — every other combination (including re-touching the current status or un-cancelling) answers `409`, and a `CANCELLED` order is terminal. Cancelling restores every line's quantity with one `RETURN` movement per item and stamps `cancelledAt`, all in the SAME Serializable transaction — cancelling twice can never restore stock twice. Soft-deleted products still receive their stock back.

### 3.8 Purchase orders

| Method | Path                           | Role  | Request body / query                                                                     | Response                                                   | Errors                                                           |
| ------ | ------------------------------ | ----- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| GET    | `/purchase-orders`             | any   | `?page&limit&status&supplierId&sortBy(createdAt,status)&sortOrder`                       | paginated `PurchaseOrder[]`                                | 400, 401                                                         |
| GET    | `/purchase-orders/:id`         | any   | —                                                                                        | `PurchaseOrder` + `items[]` + supplier                     | 400, 401, 404                                                    |
| POST   | `/purchase-orders`             | admin | `{ supplierId, expectedAt?, notes?, items: [{ productId, quantityOrdered, unitCost }] }` | `PurchaseOrder` (201, status `DRAFT`)                      | 400, 401, 403, 404, 409, 422                                     |
| PATCH  | `/purchase-orders/:id/status`  | admin | `{ newStatus: 'ORDERED' \| 'CANCELLED' }`                                                | `PurchaseOrder` (manual transition)                        | 400, 401, 403, 404, 409                                          |
| POST   | `/purchase-orders/:id/receive` | any   | `{ items: [{ productId, quantity }] }` (full or partial)                                 | `PurchaseOrder` (status → `PARTIALLY_RECEIVED`/`RECEIVED`) | 400, 401, 404, 409 (over-receive or wrong state), 422 (inactive) |

- `PurchaseOrder` shape: `{ id, orderNumber, supplierId, status, totalAmount, expectedAt, receivedAt, notes, createdById, createdAt, updatedAt }`; detail responses add `items[]` and `supplier: { id, companyName }`.
- `PurchaseOrderItem`: `{ id, purchaseOrderId, productId, quantityOrdered, quantityReceived, unitCost }`.
- `unitCost` is client input; `totalAmount` is computed server-side with decimal math. A readable sequential `orderNumber` (`PO-0001`) is generated from the row count (a concurrent race is retried once).
- `POST /purchase-orders` runs in ONE Serializable transaction and touches NO stock (a DRAFT is paperwork); missing supplier/product is 404, inactive supplier/product is 422, duplicate `productId` lines are 400.
- Manual transitions (issue #32 supersedes the contract's `/order` + `/cancel` routes): `DRAFT → ORDERED`, `DRAFT → CANCELLED`, `ORDERED → CANCELLED` — everything else (`RECEIVED`/`PARTIALLY_RECEIVED` targets, terminal states, same status) answers 409. Receiving is the only path to `PARTIALLY_RECEIVED`/`RECEIVED`.
- Receiving runs in ONE Serializable transaction: per line it increments `quantityReceived`, raises product stock and writes one `PURCHASE_RECEIPT` movement (reason `Received purchase order PO-####`, `purchaseOrderId` stamped); the status becomes `PARTIALLY_RECEIVED` or `RECEIVED` (`receivedAt` stamped on full receipt) — any failure leaves no partial data. Receiving more than the remaining quantity is 409; DRAFT/CANCELLED/RECEIVED orders are 409; a product that is not a line of the order is 400. A committed receipt fans a best-effort `PURCHASE_ORDER_RECEIVED` notification to ADMINs (AD-007).
- Not implemented in this issue (kept out of the table on purpose): `PATCH /purchase-orders/:id` (draft editing), `POST /:id/order` and `POST /:id/cancel` (replaced by `PATCH :id/status`), `DELETE /purchase-orders/:id`, and `search(orderNumber)` on the list (only status/supplier filters are implemented).

### 3.9 Notifications

| Method | Path                          | Role | Request body / query                       | Response                                 | Errors                             |
| ------ | ----------------------------- | ---- | ------------------------------------------ | ---------------------------------------- | ---------------------------------- |
| GET    | `/notifications`              | any  | `?page&limit&type&unread&sortBy&sortOrder` | paginated `Notification[]` (own only)    | 400, 401                           |
| GET    | `/notifications/unread-count` | any  | —                                          | `{ count: number }`                      | 401                                |
| PATCH  | `/notifications/:id/read`     | any  | —                                          | `Notification` (sets `isRead`, `readAt`) | 400, 401, 404 (missing or not own) |
| PATCH  | `/notifications/read-all`     | any  | —                                          | `{ updated: number }`                    | 401                                |
| GET    | `/notifications/preferences`  | any  | —                                          | `[{ type, enabled }]` (defaults filled)  | 401                                |
| PUT    | `/notifications/preferences`  | any  | `{ preferences: [{ type, enabled }] }`     | `[{ type, enabled }]` (full list)        | 400, 401                           |

`Notification` shape: `{ id, userId, type, title, message, entityType, entityId, data, isRead, readAt, createdAt }`.
Users only ever see their **own** notifications (404 for others'). Delivery: polling `unread-count` (60s) initially; upgrade path noted in §4 of the roadmap.
Notes (issue #31 supersessions): the list filter is `unread` (boolean) — `isRead` is no longer exposed; the standalone `/notification-preferences` routes and `DELETE /notifications/:id` are replaced by `/notifications/preferences` under the notifications path (and deletion is not implemented); a missing LOW_STOCK alert is never created while an unread one for the same product exists; notification creation is best-effort and can never fail a stock/order/PO operation (AD-007).

### 3.10 Dashboard

ADMIN-only (AD-009). Every route takes an optional inclusive `from`/`to` range (ISO-8601): both or neither, `from <= to`, at most 92 days — otherwise 400. Omitted range = last 30 days. Day buckets are UTC and zero-filled.

| Method | Path                         | Role  | Query                              | Response                                                                                                                                | Errors        |
| ------ | ---------------------------- | ----- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| GET    | `/dashboard/summary`         | admin | `?from&to`                         | `{ totalProducts, totalStockUnits, stockValue, lowStockCount, outOfStockCount, ordersInPeriod, revenueInPeriod, period: { from, to } }` | 400, 401, 403 |
| GET    | `/dashboard/low-stock`       | admin | `?page&limit`                      | paginated `Product[]` where `quantity <= minStock` (same query as `/stock/low-stock`)                                                   | 400, 401, 403 |
| GET    | `/dashboard/sales`           | admin | `?from&to`                         | `[{ date: 'YYYY-MM-DD', totalSales: number, orderCount: number }]` (one entry per day)                                                  | 400, 401, 403 |
| GET    | `/dashboard/top-products`    | admin | `?from&to&limit` (1–50, default 5) | `[{ productId, productName, sku, quantitySold, revenue }]`                                                                              | 400, 401, 403 |
| GET    | `/dashboard/stock-movements` | admin | `?from&to`                         | `[{ date: 'YYYY-MM-DD', unitsIn, unitsOut }]` (one entry per day)                                                                       | 400, 401, 403 |

- `stockValue` uses the **cost basis**: `SUM(quantity * costPrice)` over active products (`costPrice` NULL counts as 0) — see AD-009.
- `totalProducts`, `totalStockUnits`, `lowStockCount`, `outOfStockCount` cover **active** products only.
- `ordersInPeriod` / `revenueInPeriod` / `sales` / `top-products` exclude **CANCELLED** orders; PENDING and CONFIRMED both count (stock already left at creation — AD-002).
- Prisma `aggregate`/`groupBy`/`count` do the aggregation wherever possible; `$queryRaw` is used only for the column-math figures (`quantity * costPrice`, `quantity <= minStock`) and UTC `date_trunc` day grouping — always parameterized. Empty periods return zeros/empty arrays, never errors.
- Supersedes the earlier `/dashboard/sales-trend` (its `days` query is replaced by the `from`/`to` range on `/dashboard/sales`) and the `summary` payload listed in the original contract.

### 3.11 Audit log

| Method | Path          | Role  | Request query                                                            | Response               | Errors        |
| ------ | ------------- | ----- | ------------------------------------------------------------------------ | ---------------------- | ------------- |
| GET    | `/audit-logs` | admin | `?page&limit&userId&entityType&entityId&action&from&to&sortBy&sortOrder` | paginated `AuditLog[]` | 400, 401, 403 |

- `AuditLog` shape: `{ id, userId, action, entityType, entityId, oldValues, newValues, createdAt }` (`oldValues`/`newValues` are opaque JSON objects; `userId` may be `null`).
- Filters are exact matches (`userId`, `entityType`, `entityId`, `action`); `from`/`to` are inclusive ISO-8601 bounds on `createdAt`; `sortBy` is `createdAt` (default, `desc`) or `action`.
- Audit logs are **read-only** via the API — created server-side, never manually; there is no POST/PATCH/DELETE route.
- Actions currently written (issue #34): `product.created|updated|deleted`, `stock.adjusted`, `order.created|cancelled`, `purchase_order.received`, `user.updated|deactivated` (plus `user.password_changed` from issue #54) — see AD-010/AD-011. Category/supplier mutations are not instrumented yet.
- Sensitive keys (`password`, `*Hash*`, `*token*`, `*secret*` — case-insensitive, at any depth) are **stripped** before persisting; no password hashes or tokens can appear in `oldValues`/`newValues`.
- Logging is **best effort**: an audit write failure never aborts the operation it describes. Entries for transactional mutations are written inside the same transaction, so they commit/roll back with the change.

### 3.12 Misc

| Method | Path      | Role | Response                  | Errors    |
| ------ | --------- | ---- | ------------------------- | --------- |
| GET 🔓 | `/health` | —    | `{ status: 'ok', db: 'up' | 'down' }` | —   |

### 3.13 Reports (CSV exports)

All routes are **ADMIN-only** and authenticated; they answer `200` with `Content-Type: text/csv; charset=utf-8` and `Content-Disposition: attachment; filename="<report>.csv"`. Exports are read-only and contain **every** matching row (no pagination). Fields are RFC-4180 escaped (quotes doubled, commas/newlines quoted) and text starting with `= + - @` is prefixed with `'` to prevent formula injection.

| Method | Path                           | Role  | Query                                                           | Filename                          | Errors        |
| ------ | ------------------------------ | ----- | --------------------------------------------------------------- | --------------------------------- | ------------- |
| GET    | `/reports/inventory.csv`       | admin | `?search&categoryId&supplierId&isActive&stockStatus`            | `inventory-YYYY-MM-DD.csv`        | 400, 401, 403 |
| GET    | `/reports/low-stock.csv`       | admin | —                                                               | `low-stock-YYYY-MM-DD.csv`        | 401, 403      |
| GET    | `/reports/sales.csv`           | admin | `?from&to` (both or neither; default last 30 days; max 92 days) | `sales-YYYY-MM-DD_YYYY-MM-DD.csv` | 400, 401, 403 |
| GET    | `/reports/stock-movements.csv` | admin | `?productId&type&orderId&purchaseOrderId&from&to`               | `stock-movements-<range>.csv`     | 400, 401, 403 |

- **Inventory** columns: `SKU, Name, Category, Supplier, Quantity, Min Stock, Price, Cost Price, Active` (`yes`/`no`). `isActive` defaults to `true`; `stockStatus` uses the `/products` semantics (`in_stock`, `low_stock` = `quantity <= minStock`, `out_of_stock`). The cost column is why this is ADMIN-only (AD-004).
- **Low stock** columns: the same products filtered to `isActive = true` and `quantity <= minStock`, plus `Shortfall` (`max(0, minStock - quantity)`).
- **Sales** columns: `Order Number, Created At, Status, Customer, Phone, Items, Total, Created By`; one row per order in the period and **CANCELLED orders are excluded** (same rules as the dashboard, AD-009).
- **Stock movements** columns: `Created At, SKU, Product, Type, Change, Quantity After, Reason, Order Number, Purchase Order Number, Created By`; filters match `GET /stock/movements`.
- Empty results still return the header row (valid CSV). Underlying data is queried directly by the reports service — there is no separate JSON "reports API" yet (AD-012).

### 3.14 Public catalog

Anonymous visitors browse only active products in active categories. These routes never require a token and never expose internal product data (AD-018).

| Method | Path                         | Role | Query                                                                                              | Response                          | Errors |
| ------ | ---------------------------- | ---- | -------------------------------------------------------------------------------------------------- | --------------------------------- | ------ |
| GET 🔓 | `/catalog/products`          | —    | `?page&limit(max 50)&search(name)&categoryId&sort(name,price,newest)&order(asc,desc)`               | paginated `CatalogProduct[]`      | 400, 429 |
| GET 🔓 | `/catalog/products/:id`      | —    | —                                                                                                  | `CatalogProduct`                  | 400 (invalid id), 404, 429 |
| GET 🔓 | `/catalog/categories`        | —    | `?page&limit(max 50)`                                                                              | paginated `CatalogCategory[]`     | 400, 429 |

`CatalogProduct`: `{ id, sku, name, description, price, imageUrl, category: { id, name }, inStock, maxOrderable }`.

- `price` is a JSON **number** on this customer-facing endpoint (the same serialization as `GET /products`).
- `inStock` is `quantity > 0`; `maxOrderable` is `min(quantity, 20)`, or `0` when out of stock. The exact quantity, `minStock`, `costPrice`, `barcode`, supplier, `isActive` and timestamps are never returned.
- `imageUrl` is `null`, an external `https://...` URL or a relative `/uploads/products/...` path.
- `sku` is included because it is already customer-visible in the customer-safe order items (`GET /orders/mine`) and the storefront cart.
- Only `isActive = true` products **and** `isActive = true` categories are visible. Unknown, inactive and inactive-category products all answer the same `404` so hidden rows cannot be probed.
- `search` matches the product **name** only. `sort=newest` maps to `createdAt`; `order` defaults to `desc` for `newest` and `asc` for `name`/`price`. Every sort has an ascending `id` tie-break for deterministic pagination.
- Both list endpoints use the §1 envelope with `limit` capped at **50** (instead of the private API's 100).
- Rate limiting is stricter than the private API: **30 requests per minute per client per route** (global private default is 100/minute).

`CatalogCategory`: `{ id, name, description }`. Only active categories are listed; `isActive`, timestamps and product counters are internal and omitted.

### 3.15 Contact messages

A public contact form feeds a private support inbox. `SUPPORT` and `ADMIN` hold `contact.read` and `contact.manage`; `STAFF` and `CUSTOMER` receive `403`. The internal note and assignee are **never** exposed by a public route (AD-019).

| Method  | Path                     | Role           | Request body / query                                                        | Response                    | Errors                                  |
| ------- | ------------------------ | -------------- | --------------------------------------------------------------------------- | --------------------------- | --------------------------------------- |
| POST 🔓 | `/contact`               | —              | `{ name(max 100), email(valid, max 255), subject(max 200), message(max 5000), honeypot? }` | `{ received: true }` (201)  | 400, 429                                |
| GET     | `/contact-messages`      | SUPPORT, ADMIN | `?page&limit&status&assignedToId&search(name,email,subject)`                | paginated `ContactMessage[]` | 400, 401, 403                          |
| GET     | `/contact-messages/:id`  | SUPPORT, ADMIN | —                                                                           | `ContactMessage`            | 400 (invalid id), 401, 403, 404         |
| PATCH   | `/contact-messages/:id`  | SUPPORT, ADMIN | `{ status?, assignedToId?, internalNote? }`                                 | `ContactMessage`            | 400, 401, 403, 404                      |

`ContactMessage`: `{ id, name, email, subject, message, status, assignedToId, assignedTo, internalNote, createdAt, updatedAt }`.

- `status` is the `ContactStatus` enum: `NEW` (default), `IN_PROGRESS`, `RESOLVED`.
- `assignedTo` is `{ id, name, email, role } | null`; `assignedToId` may be set to `null` to unassign. The assignee must be an **active SUPPORT or ADMIN** user — unknown, inactive or other-role ids answer `404` (the message is left unchanged).
- Every change of `status` writes an audit entry (`action: contact_message.status_changed`, `entityType: contact_message`) with the actor in `userId` and the previous/new status plus `changedBy` in `oldValues`/`newValues` (§3.11).
- `internalNote` (max 5000) is private triage text and can be cleared with `null`.
- The list is newest first with an `id` ascending tie-break. `search` is case-insensitive over name, email and subject; `status` and `assignedToId` are exact filters.
- `POST /contact` trims every text field. `honeypot` is optional and ignored by real clients; when non-empty the API still answers `201 { received: true }` but stores nothing. Submissions are throttled to **5 requests per hour per client** (`429` beyond that), and the 201 body never contains a message id, assignee or internal note.
- All four fields are required and the global `ValidationPipe` rejects unknown properties (including `status`, `assignedToId` and `internalNote`) with `400`.

---

## 4. Statuses & transitions (reference)

**Order:** `PENDING → CONFIRMED` (deducts nothing extra; stock leaves at creation)
`PENDING|CONFIRMED → CANCELLED` (restores stock on cancel; terminal, no further transitions)
**PurchaseOrder:** `DRAFT → ORDERED → PARTIALLY_RECEIVED → RECEIVED`, and `DRAFT|ORDERED → CANCELLED`.
Manual endpoints only perform `DRAFT → ORDERED` and the two cancels (`PATCH /purchase-orders/:id/status`); the `PARTIALLY_RECEIVED`/`RECEIVED` steps happen exclusively through `POST /purchase-orders/:id/receive`.
`RECEIVED`/`CANCELLED` are terminal.

---

## 5. Frontend safe assumptions

- Any response not shown here (extra fields) must be ignored by the frontend, not depended on.
- New fields may be added to responses without a major version bump; breaking changes go to `/api/v2`.
- Rate limiting: the global private default is 100 requests/minute; sensitive routes are stricter (registration, customer order creation, public catalog — see the endpoint sections). Treat `429` as retryable.
- The frontend may generate mock data against this file directly; every page should be achievable with no backend running.

---

## 6. Approval

| Role     | Name | Reviewed (date) | Sign-off |
| -------- | ---- | --------------- | -------- |
| Backend  | —    | —               | —        |
| Frontend | —    | —               | —        |

Fill this in via PR review. Contract changes after sign-off require a new PR touching this file.
