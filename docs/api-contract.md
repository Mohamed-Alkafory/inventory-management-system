# API Contract — Inventory Management System

> **Source of truth for the HTTP surface.** Frontend and backend build against this
> document. It is generated from `backend/src/**/*.controller.ts`,
> `backend/src/auth/permissions.ts`, the DTOs and the response serializers.
> Data models mirror `backend/prisma/schema.prisma` (see `docs/database-schema.md`).
>
> When the code and this file disagree, the code wins — and this file must be fixed
> in the same change.

---

## 1. Conventions

### Base URL

- **Default dev setup (docker compose):** `http://localhost:3010/api/v1`
  - `docker-compose.yml` publishes the backend container port `3000` on host
    `${BACKEND_PORT:-3010}`.
  - The Vite dev server proxies `/api` and `/uploads` to `http://localhost:3010`.
- **Backend run directly (no compose port mapping):** `http://localhost:3000/api/v1`
  (`PORT` defaults to `3000` in `backend/src/env.validation.ts` / `main.ts`).
- All paths below are relative to the base URL.
- Version prefix `/api/v1` is mandatory; a future `/api/v2` may coexist.
- Uploaded files are **not** under `/api/v1`; they are served from `/uploads/...`.

### JSON casing

- Request **and** response bodies use **camelCase** (`minStock`, `costPrice`, `createdAt`).
- Query parameter names are camelCase too (`?page=1&sortBy=createdAt`).
- No snake_case and no PascalCase in the JSON layer, ever.

### Date & time format

- All timestamps are ISO 8601 strings in **UTC**, e.g. `2026-10-19T14:30:00.000Z`.
- Date-only fields (`expectedAt`, `receivedAt` when sent by the client) also use full
  ISO 8601 timestamps; the client never sends bare `YYYY-MM-DD`.
- The `Z` suffix is always present. No local-timezone offsets from the client.

### Money

- Money is serialized as a JSON **number** (Prisma `DECIMAL` is converted with
  `Number(...)`), never as a string.
- Fields that are numbers: `Product.price`, `Product.costPrice` (ADMIN only),
  `Order.totalAmount`, `OrderItem.unitPrice`, `OrderItem.lineTotal`,
  `CustomerOrder.totalAmount`, customer order item `unitPrice`/`lineTotal`,
  `PurchaseOrder.totalAmount`, `PurchaseOrderItem.unitCost`, dashboard
  `stockValue`/`revenueInPeriod`/`totalSales`/`revenue`, and money columns in CSV exports.
- Requests that accept money (`price`, `costPrice`, `unitCost`) also accept JSON numbers.
- Example: `19.99`, not `"19.99"`. The frontend formats currency for display; do not
  parse these fields as strings.

### Authentication

- `Authorization: Bearer <accessToken>` on every protected endpoint.
- Access tokens live **15 minutes** (`expiresIn: 900`).
- Refresh tokens live 7 days and **rotate on every refresh**. A presented refresh token
  is revoked; replaying it answers `401`.
- Tokens are **not** stored in cookies by the API; the frontend holds them and attaches
  the header.
- Public (no token) endpoints: `POST /auth/login`, `POST /auth/register`,
  `POST /auth/refresh`, `GET /health`, `POST /contact`,
  `GET /catalog/products`, `GET /catalog/products/:id`, `GET /catalog/categories`.

### Roles

- Four roles (Prisma `UserRole`): `ADMIN`, `STAFF`, `SUPPORT`, `CUSTOMER`.
- `ADMIN` holds **every** permission and is a superset of every other role.
- `STAFF` is the operational subset: products/categories/suppliers read, orders
  create/edit/status, stock read/adjust, purchase-order read/receive.
- `SUPPORT` reads products, categories and all orders, cancels **PENDING** orders only,
  reads/writes internal order notes, and owns the contact inbox. It cannot create,
  edit, confirm or otherwise change an order, adjust/read stock movements, read
  suppliers or purchase orders, manage users, read dashboard/reports/audit, or see
  `costPrice`.
- `CUSTOMER` operates on **its own** orders only: `orders.create_own`,
  `orders.read_own`, `orders.cancel_own`, plus the any-authenticated own-account and
  notification routes.
- Public `POST /auth/register` always creates a `CUSTOMER`. The body has no `role`
  field and a client-supplied `role` is rejected with `400`.
- An ADMIN creates all roles through `POST /users` (`users.manage`).
- Authorization is **deny-by-default**: every handler declares exactly one of
  `@Public()`, `@AnyAuthenticated()` or `@RequirePermission(...)`. A handler with
  none answers `403 FORBIDDEN`, even for an authenticated ADMIN. The permission map
  is `backend/src/auth/permissions.ts` and is documented in `docs/decisions.md`
  (AD-015, AD-016, AD-017, AD-019, AD-020).

### Pagination

Paginated list endpoints return the envelope:

```json
{
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 143, "totalPages": 8 }
}
```

- Query params: `page` (1-based, default 1), `limit` (default 20, max 100).
- Public catalog endpoints use the same envelope but cap `limit` at **50**.
- Non-paginated endpoints return a bare array and are marked below
  (`/orders/:id/notes`, `/notifications/preferences`, dashboard series).
- Sorting uses `sortBy` + `sortOrder` (`asc` | `desc`); allowed `sortBy` values are
  listed per endpoint. Ties are broken by `id` ascending where documented.
- On routes that bind a query DTO, unknown query parameters are rejected with `400`
  by the global whitelist pipe. Routes without a query DTO ignore extra query params.

### IDs

- UUID v4 strings everywhere, including URLs. A malformed UUID on a route that uses
  `ParseUUIDPipe` answers `400`.

---

## 2. Standard error response

Every non-2xx response uses this shape (from `AllExceptionsFilter`):

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "VALIDATION_ERROR",
  "fieldErrors": {
    "quantity": ["quantity must be greater than 0"]
  },
  "path": "/api/v1/orders/mine",
  "timestamp": "2026-10-30T14:30:00.000Z"
}
```

| Field         | Type                     | Always present | Notes                                                  |
| ------------- | ------------------------ | -------------- | ------------------------------------------------------ |
| `statusCode`  | number                   | yes            | HTTP status, duplicated in the body                    |
| `message`     | string \| string[]       | yes            | Human-readable summary; arrays allowed (Nest default)  |
| `error`       | string                   | yes            | Machine-readable code derived from the HTTP status     |
| `fieldErrors` | Record<string, string[]> | no             | Only for `400` validation errors; maps JSON key → messages |
| `path`        | string                   | yes            | Request URL                                            |
| `timestamp`   | string                   | yes            | ISO 8601 UTC                                           |

Error codes:

| Code                  | HTTP | Meaning                                                                 |
| --------------------- | ---- | ----------------------------------------------------------------------- |
| `VALIDATION_ERROR`    | 400  | Body/query failed class-validator checks or unknown field              |
| `UNAUTHORIZED`        | 401  | Missing/expired/invalid token, bad credentials, deactivated account    |
| `FORBIDDEN`           | 403  | Authenticated but missing the required permission                      |
| `NOT_FOUND`           | 404  | Resource missing, hidden, or not owned by the caller                   |
| `CONFLICT`            | 409  | Duplicate unique value, invalid transition, stock shortage, last admin |
| `PAYLOAD_TOO_LARGE`   | 413  | Uploaded image exceeds the route limit                                 |
| `BUSINESS_RULE_ERROR` | 422  | Semantic rule violation (inactive product, non-PENDING edit, bad password) |
| `INTERNAL_ERROR`      | 500  | Unexpected server failure                                              |
| `SERVICE_UNAVAILABLE` | 503  | Database or dependency unavailable                                     |

> **429 note:** `@nestjs/throttler` throws a `429`, but `errorCodeForStatus` has no
> `429` branch, so the body currently carries `"error": "INTERNAL_ERROR"` with
> `statusCode: 429`. Treat HTTP `429` as the signal and ignore the `error` string.

---

## 3. Access classes and role-permission matrix

Endpoints are grouped below by the **lowest access class** that can call them. The
`Access` column repeats the full role set, because `ADMIN` always holds every
permission.

Matrix generated from `ROLE_PERMISSIONS` and the controller decorators:

| Endpoint group | Anonymous | CUSTOMER | SUPPORT | STAFF | ADMIN |
| --- | --- | --- | --- | --- | --- |
| `POST /auth/login`, `/register`, `/refresh` | yes | yes | yes | yes | yes |
| `GET /health` | yes | yes | yes | yes | yes |
| `GET /catalog/products`, `/:id`, `/categories` | yes | yes | yes | yes | yes |
| `POST /contact` | yes | yes | yes | yes | yes |
| Own account (`/auth/me`, change-password, logout, avatar) | no | yes | yes | yes | yes |
| Notifications (all `/notifications/*`) | no | yes | yes | yes | yes |
| Products read (`GET /products`, `GET /products/:id`) | no | no | yes | yes | yes |
| Categories read (`GET /categories`, `GET /categories/:id`) | no | no | yes | yes | yes |
| Orders list/detail (`GET /orders`, `GET /orders/:id`) | no | no | yes | yes | yes |
| Order PENDING cancel (`POST /orders/:id/cancel`) | no | no | yes | yes | yes |
| Order notes (`GET/POST /orders/:id/notes`) | no | no | yes | yes | yes |
| Contact inbox (`/contact-messages/*`) | no | no | yes | yes | yes |
| Customer own orders (`/orders/mine/*`) | no | yes | no | no | yes |
| Order create/edit/status (`POST /orders`, `PATCH /orders/:id`, `PATCH /orders/:id/status`) | no | no | no | yes | yes |
| Suppliers read | no | no | no | yes | yes |
| Stock read/adjust | no | no | no | yes | yes |
| Purchase orders read/receive | no | no | no | yes | yes |
| Users management (`/users/*`) | no | no | no | no | yes |
| Product/category/supplier writes and image uploads | no | no | no | no | yes |
| Purchase order create/status | no | no | no | no | yes |
| Dashboard | no | no | no | no | yes |
| Reports | no | no | no | no | yes |
| Audit log | no | no | no | no | yes |
| `GET /auth/admin-only` | no | no | no | no | yes |

> `ADMIN` appears as **yes** for `/orders/mine` because it holds every permission
> (AD-017). In practice those routes filter by `customerId = caller`, so an admin only
> sees orders whose `customerId` is their own user id (normally none).

---

## 4. Public endpoints (no token)

### 4.1 Auth

| Method | Path | Request body | Response | Statuses / errors |
| --- | --- | --- | --- | --- |
| POST | `/auth/login` | `{ email, password }` (`password` 8–72 bytes) | `Session` (200) | 400, 401 |
| POST | `/auth/register` | `{ name (2–100), email, password (8–72 bytes) }` | `Session` (201); `user.role` is always `CUSTOMER` | 400, 409; **5 req/min** |
| POST | `/auth/refresh` | `{ refreshToken }` (min 20 chars) | `SessionTokens` (200) | 400, 401 |

`Session`:

```ts
{
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: 900;          // seconds
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: "ADMIN" | "STAFF" | "SUPPORT" | "CUSTOMER";
  };
}
```

`SessionTokens` is the same object without `user`.

- `401` for unknown email, wrong password or a deactivated account; the message is the
  same (`Invalid credentials`) so account existence is not disclosed.
- `409` when registering an email that already exists.
- `POST /auth/register` rejects a client-supplied `role` (or any unknown field) with
  `400`.
- Refresh rotation: a valid refresh token is revoked and replaced; a reused, expired,
  revoked or deactivated-user token answers `401`.

### 4.2 Health

| Method | Path | Response | Statuses |
| --- | --- | --- | --- |
| GET | `/health` | `{ status: "ok", db: "up" }` | 200; 503 standard error when the DB is unreachable |

### 4.3 Public catalog

Anonymous visitors browse only active products in active categories. These routes never
expose internal product data (AD-018). All three are throttled to **30 requests per
minute per client per route**.

| Method | Path | Query | Response | Statuses / errors |
| --- | --- | --- | --- | --- |
| GET | `/catalog/products` | `page`, `limit` (max 50), `search` (name only, max 100), `categoryId` (UUID), `sort` (`name`\|`price`\|`newest`, default `newest`), `order` (`asc`\|`desc`) | paginated `CatalogProduct[]` | 400, 429 |
| GET | `/catalog/products/:id` | — | `CatalogProduct` | 400 (invalid UUID), 404, 429 |
| GET | `/catalog/categories` | `page`, `limit` (max 50) | paginated `CatalogCategory[]` | 400, 429 |

```ts
CatalogProduct = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  category: { id: string; name: string };
  inStock: boolean;
  maxOrderable: number;   // min(quantity, 20); 0 when out of stock
};

CatalogCategory = {
  id: string;
  name: string;
  description: string | null;
};
```

- Unknown ids, inactive products and products in inactive categories all answer the
  same `404`, so hidden rows cannot be probed.
- `order` defaults to `desc` for `newest` and `asc` for `name`/`price`; every sort has
  an ascending `id` tie-break.
- `costPrice`, `minStock`, exact `quantity`, `barcode`, `supplier`, `isActive`,
  `categoryId` and timestamps are never returned.

### 4.4 Contact submission

| Method | Path | Request body | Response | Statuses / errors |
| --- | --- | --- | --- | --- |
| POST | `/contact` | `{ name (≤100), email (valid, ≤255), subject (≤200), message (≤5000), honeypot? (≤255) }` | `{ received: true }` (201) | 400, 429; **5 req/hour** |

- Every text field is trimmed; all four main fields are required; unknown fields are
  rejected with `400`.
- `honeypot` is a spam trap: when non-empty the API still answers `201 { received: true }`
  but stores nothing.
- A real submission sends a best-effort `CONTACT_MESSAGE_RECEIVED` notification to
  active SUPPORT users only.
- The 201 body never contains a message id, assignee or internal note.

---

## 5. Any authenticated user

All four roles can call these. Ownership is enforced in the service, not by the URL.

### 5.1 Own account (`/auth`)

| Method | Path | Request body | Response | Statuses / errors |
| --- | --- | --- | --- | --- |
| GET | `/auth/me` | — | `User` (200) | 401 |
| PATCH | `/auth/me` | `{ name? (2–100), password? { current, next } (8–72 bytes each) }` | `User` (200) | 400, 401, 422 |
| DELETE | `/auth/me` | — | 204 empty (soft-deactivate) | 401, 409 |
| POST | `/auth/change-password` | `{ currentPassword, newPassword }` (8–72 bytes each) | 204 empty | 400, 401, 422 |
| POST | `/auth/logout` | `{ refreshToken }` (min 20) | 204 empty | 401 (only if the guard rejects the access token); unknown tokens still answer 204 |
| POST | `/users/me/avatar` | `multipart/form-data`, field `image` | `User` (200) with new `avatarUrl` | 400 (missing/unsupported), 401, 413 (>1 MB) |
| DELETE | `/users/me/avatar` | — | 204 empty | 401 |

`User`:

```ts
{
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: "ADMIN" | "STAFF" | "SUPPORT" | "CUSTOMER";
  isActive: boolean;
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
}
```

- `passwordHash` is **never** returned.
- `PATCH /auth/me` only accepts `name` and the nested `password`. `role`, `email` and
  `isActive` remain ADMIN-managed; sending them is `400`.
- A wrong `current` password is **422** (authenticated request, invalid input), not 401.
- A successful password change revokes every active refresh token. The current access
  token stays valid until it expires.
- `DELETE /auth/me` deactivates the caller and revokes all refresh tokens. The last
  active ADMIN cannot self-deactivate: `409 CONFLICT`
  (`At least one active ADMIN must remain`).
- Avatar uploads accept JPEG, PNG or WebP (detected from magic bytes) up to **1 MB**.
  `avatarUrl` is `null` or a relative `/uploads/avatars/<uuid>.<jpg|png|webp>` path.

### 5.2 Notifications

All routes force `userId = caller`. A missing notification and another user's
notification both answer `404`.

| Method | Path | Query / body | Response | Statuses / errors |
| --- | --- | --- | --- | --- |
| GET | `/notifications` | `page`, `limit`, `type`, `unread` (boolean), `sortBy` (`createdAt`\|`type`), `sortOrder` | paginated `Notification[]` (200) | 400, 401 |
| GET | `/notifications/unread-count` | — | `{ count: number }` (200) | 401 |
| PATCH | `/notifications/read-all` | — | `{ updated: number }` (200) | 401 |
| PATCH | `/notifications/:id/read` | — | `Notification` (200) | 400, 401, 404 |
| GET | `/notifications/preferences` | — | `Preference[]` (200; all 7 types, defaults filled) | 401 |
| PUT | `/notifications/preferences` | `{ preferences: [{ type, enabled }] }` — **1–5 rows per request** | full `Preference[]` (200) | 400, 401 |

```ts
Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  data: unknown;       // opaque JSON
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

Preference = { type: NotificationType; enabled: boolean };
```

`NotificationType` = `LOW_STOCK` | `ORDER_CREATED` | `ORDER_CONFIRMED` |
`ORDER_CANCELLED` | `PURCHASE_ORDER_RECEIVED` | `CONTACT_MESSAGE_RECEIVED` |
`SYSTEM`.

- `unread=true` lists only unread rows; `unread=false` lists only read rows; omit it to
  list both.
- `GET /notifications/preferences` returns all seven types even if a type never fans
  out to the caller's role.
- `PUT /notifications/preferences` upserts the supplied rows and returns the full
  list. The DTO cap is 5 rows, so a client sending all seven types must split the call.

Notification fan-out (AD-021):

| Type | Recipient(s) |
| --- | --- |
| `LOW_STOCK` | active ADMIN users (one unread alert per product/recipient) |
| `ORDER_CREATED` | active ADMIN for a staff order; active STAFF + ADMIN for a customer order |
| `ORDER_CONFIRMED` | the owning CUSTOMER only (walk-in orders without `customerId` notify nobody) |
| `ORDER_CANCELLED` | active ADMIN + the owning CUSTOMER when present |
| `PURCHASE_ORDER_RECEIVED` | active ADMIN users |
| `CONTACT_MESSAGE_RECEIVED` | active SUPPORT users |
| `SYSTEM` | reserved; no automatic fan-out |

---

## 6. CUSTOMER — own orders (`/orders/mine`)

`ADMIN` also holds these permissions (superset); every route still scopes by
`customerId = caller`. The shapes below are an explicit allow-list — no internal field
can leak.

| Method | Path | Request / query | Response | Statuses / errors |
| --- | --- | --- | --- | --- |
| POST | `/orders/mine` | body below | `CustomerOrder` (201) | 400, 401, 403, 404 (product), 409 (stock), 422 (inactive), 429; **10 req/min** |
| GET | `/orders/mine` | `page`, `limit` (max 100), `status` (`PENDING`\|`CONFIRMED`\|`CANCELLED`) | paginated `CustomerOrder[]` (200), newest first | 400, 401, 403 |
| GET | `/orders/mine/:id` | — | `CustomerOrder` (200) | 400, 401, 403, 404 (missing **or** not owned) |
| POST | `/orders/mine/:id/cancel` | — | `CustomerOrder` (201) with `cancelledAt` | 400, 401, 403, 404 (missing **or** not owned), 409 (not PENDING) |

`POST /orders/mine` body:

```ts
{
  items: Array<{ productId: string; quantity: number }>; // 1–30 distinct lines, each 1–50
  recipientName: string;     // 1–100
  recipientPhone: string;    // 1–20
  shippingAddress: string;   // 1–500
  shippingCity: string;      // 1–100
  notes?: string;            // ≤2000, internal only
}
```

- Only active products are accepted. Duplicate `productId` lines, unknown properties
  (`price`, `status`, `customerId`, `createdById`, …) and out-of-range quantities are
  `400`.
- Prices, line totals, `totalAmount`, `status`, `customerId` and `createdById` are set
  server-side from the token/catalogue. The client cannot send them.
- `recipientName`/`recipientPhone` are copied into `customerName`/`customerPhone` so
  staff screens render; the customer response exposes only the recipient fields.
- Stock is deducted at creation and restored on cancellation (AD-002).
- Unknown ids and other customers' orders are both `404`, never `403`, so ownership
  cannot be probed.

`CustomerOrder`:

```ts
{
  id: string;
  orderNumber: string;          // e.g. "ORD-0001"
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  totalAmount: number;
  items: Array<{
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  recipientName: string | null;
  recipientPhone: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  paymentMethod: "COD";
  createdAt: string;
  cancelledAt: string | null;
}
```

Never present in a customer response: `customerId`, `createdById`, `createdBy`,
`customerName`, `customerPhone`, the legacy scalar `notes`, internal order notes,
`stockMovements`, audit data, product/item ids, `costPrice`, `minStock`, exact stock,
`barcode`, supplier, `isActive` or timestamps other than `createdAt`/`cancelledAt`.

---

## 7. SUPPORT — support desk and order visibility

SUPPORT holds `products.read`, `categories.read`, `orders.read_all`,
`orders.cancel_pending`, `orders.notes.read`, `orders.notes.write`, `contact.read`,
`contact.manage`. STAFF and ADMIN also hold these routes.

### 7.1 Products and categories (read)

| Method | Path | Query | Response | Statuses / errors |
| --- | --- | --- | --- | --- |
| GET | `/products` | `page`, `limit`, `search`, `categoryId`, `supplierId`, `isActive`, `stockStatus` (`in_stock`\|`low_stock`\|`out_of_stock`), `sortBy` (`name`\|`sku`\|`price`\|`quantity`\|`createdAt`), `sortOrder` | paginated `Product[]` (200; `costPrice` omitted for non-ADMIN) | 400, 401, 403 |
| GET | `/products/:id` | — | `Product` + `category`, `supplier` (200) | 400, 401, 403, 404 |
| GET | `/categories` | `page`, `limit`, `search`, `isActive` | paginated `Category[]` (200; active only by default) | 400, 401, 403 |
| GET | `/categories/:id` | — | `Category` + `productCount` (200) | 400, 401, 403, 404 |

- `stockStatus=low_stock` → `quantity <= minStock`; `in_stock` → `quantity > 0`;
  `out_of_stock` → `quantity = 0`.
- Soft-deleted rows still resolve by id (AD-001).
- `costPrice` is omitted entirely (not `null`) for SUPPORT/STAFF.

### 7.2 Orders (read, PENDING cancel, notes)

| Method | Path | Query / body | Response | Statuses / errors |
| --- | --- | --- | --- | --- |
| GET | `/orders` | `page`, `limit`, `status`, `search` (orderNumber/customerName), `createdById` (UUID), `from`, `to` (inclusive ISO 8601), `sortBy` (`status`\|`createdAt`), `sortOrder` | paginated `Order[]` (200) | 400, 401, 403 |
| GET | `/orders/:id` | — | `OrderDetail` (200; PII-bearing and audited for SUPPORT/STAFF) | 400, 401, 403, 404 |
| POST | `/orders/:id/cancel` | — | `Order` + `items[]` (201) | 400, 401, 403, 404, 409 (not PENDING / double cancel) |
| POST | `/orders/:id/notes` | `{ note }` (trimmed, 1–2000 chars) | `OrderNote` (201) | 400, 401, 403, 404 |
| GET | `/orders/:id/notes` | — | `OrderNote[]` (200, oldest first, **not paginated**) | 400, 401, 403, 404 |

`Order` (staff/SB shape):

```ts
{
  id: string;
  orderNumber: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;          // legacy scalar, internal
  totalAmount: number;
  customerId: string | null;     // set for customer orders
  recipientName: string | null;
  recipientPhone: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  paymentMethod: "COD";
  createdById: string;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
}
```

`OrderDetail` adds:

```ts
{
  items: OrderItem[];
  createdBy: { id: string; name: string; email: string };
  stockMovements: Array<{
    id: string;
    productId: string;
    type: "SALE" | "RETURN" | "ADJUSTMENT" | "PURCHASE_RECEIPT";
    quantityChange: number;
    quantityAfter: number;
    reason: string | null;
    createdAt: string;
  }>;
}
```

`OrderItem`:

```ts
{
  id: string;
  orderId: string;
  productId: string;
  productName: string;  // snapshot
  sku: string;          // snapshot
  quantity: number;
  unitPrice: number;    // snapshot
  lineTotal: number;
}
```

`OrderNote` (internal only):

```ts
{
  id: string;
  orderId: string;
  authorId: string;
  note: string;
  author: { id: string; name: string };
  createdAt: string;
}
```

- `GET /orders` is newest first by `createdAt DESC` with `id ASC` as tie-breaker.
  `status` accepts only the three order statuses. `from`/`to` are inclusive bounds on
  `createdAt`; an invalid date or `from > to` is `400`.
- **SUPPORT data minimization:** SUPPORT rows in `GET /orders` omit `customerPhone`,
  `recipientPhone` and `shippingAddress`. `GET /orders/:id` returns the full order, and
  every SUPPORT or STAFF detail view writes an `order.viewed` audit entry containing
  only the viewer id/role and order id — never the personal data. ADMIN detail views
  and all list calls are not audited (AD-020).
- `POST /orders/:id/cancel` cancels **only PENDING** orders. `CONFIRMED`, `CANCELLED`
  and every other state answer `409`. It restores stock exactly once with one `RETURN`
  movement per line, stamps `cancelledAt`, writes `order.cancelled`, and sends the
  best-effort notifications. It cannot confirm or perform any other transition.
- Notes are exposed only by the two note routes. `/orders/mine` never includes them.

### 7.3 Contact inbox

| Method | Path | Query / body | Response | Statuses / errors |
| --- | --- | --- | --- | --- |
| GET | `/contact-messages` | `page`, `limit`, `status` (`NEW`\|`IN_PROGRESS`\|`RESOLVED`), `assignedToId` (UUID), `search` (name/email/subject) | paginated `ContactMessage[]` (200), newest first | 400, 401, 403 |
| GET | `/contact-messages/:id` | — | `ContactMessage` (200) | 400, 401, 403, 404 |
| PATCH | `/contact-messages/:id` | `{ status?, assignedToId?, internalNote? }` | `ContactMessage` (200) | 400, 401, 403, 404 |

`ContactMessage`:

```ts
{
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "NEW" | "IN_PROGRESS" | "RESOLVED";
  assignedToId: string | null;
  assignedTo: { id: string; name: string; email: string; role: string } | null;
  internalNote: string | null;
  createdAt: string;
  updatedAt: string;
}
```

- `assignedToId` may be `null` to unassign. A non-null id must resolve to an **active
  SUPPORT or ADMIN** user; unknown, inactive and wrong-role ids all answer `404` and
  leave the row unchanged.
- `internalNote` (≤5000) is private triage text and can be cleared with `null`.
- Every actual status change writes `contact_message.status_changed` with the actor,
  previous status and new status. Note/assignee-only edits are not audited.
- The list is newest first with `id ASC` tie-break; `search` is case-insensitive over
  name, email and subject; `status`/`assignedToId` are exact filters.

---

## 8. STAFF — operational routes

STAFF holds `products.read`, `categories.read`, `suppliers.read`, `orders.create`,
`orders.read_all`, `orders.update`, `orders.update_status`, `orders.cancel_pending`,
`orders.notes.read`, `orders.notes.write`, `stock.read`, `stock.adjust`, `po.read`,
`po.receive`. ADMIN also holds all of these.

### 8.1 Staff orders (`POST`, edit, status)

| Method | Path | Request / body | Response | Statuses / errors |
| --- | --- | --- | --- | --- |
| POST | `/orders` | `{ items: [{ productId, quantity }] (1–100 lines), customerName?, customerPhone?, notes? }` | `Order` + `items[]` (201) | 400, 401, 403, 404 (product), 409 (stock), 422 (inactive) |
| PATCH | `/orders/:id` | `{ customerName?, customerPhone?, notes? }` — only while `PENDING` | `Order` (200) | 400, 401, 403, 404, 422 (not PENDING) |
| PATCH | `/orders/:id/status` | `{ newStatus: "CONFIRMED" \| "CANCELLED" }` | `Order` + `items[]` (200) | 400, 401, 403, 404, 409 (invalid transition) |

- `POST /orders` snapshots product name/SKU/price, computes `totalAmount` server-side,
  deducts stock with one `SALE` movement per line, and writes `order.created` — all in
  one Serializable transaction. `createdById` comes from the token.
- `PATCH /orders/:id` edits metadata only; items and quantities cannot be changed.
  An order in `CONFIRMED`/`CANCELLED` answers `422`.
- `PATCH /orders/:id/status` is the **only** route that can confirm an order. Allowed
  targets are `CONFIRMED` and `CANCELLED`; `PENDING` is a valid enum value but no
  transition ends there, so it answers `409`. A `CANCELLED` order is terminal.
- `PATCH /orders/:id/status` to `CONFIRMED` sends `ORDER_CONFIRMED` to the owning
  customer when `customerId` exists. Cancellation sends `ORDER_CANCELLED` to the
  customer in addition to the ADMIN alert.
- `totalAmount` is always computed from item snapshots; client-sent prices are ignored
  (unknown body fields are `400`).

### 8.2 Suppliers (read)

| Method | Path | Query | Response | Statuses / errors |
| --- | --- | --- | --- | --- |
| GET | `/suppliers` | `page`, `limit`, `search`, `isActive` | paginated `Supplier[]` (200; active only by default) | 400, 401, 403 |
| GET | `/suppliers/:id` | — | `Supplier` + `productCount` (200) | 400, 401, 403, 404 |

`Supplier`: `{ id, companyName, email, phone, address, isActive, createdAt, updatedAt }`.

### 8.3 Stock

| Method | Path | Query / body | Response | Statuses / errors |
| --- | --- | --- | --- | --- |
| GET | `/stock/movements` | `page`, `limit`, `productId`, `type`, `orderId`, `purchaseOrderId`, `from`, `to`, `sortBy` (`createdAt`\|`quantityChange`\|`type`), `sortOrder` | paginated `StockMovement[]` (200) | 400, 401, 403 |
| GET | `/products/:id/movements` | same filters, forced to the path product | paginated `StockMovement[]` (200) | 400, 401, 403, 404 |
| POST | `/stock/adjustments` | `{ productId, quantityChange (non-zero int), reason (1–500) }` | `{ movement: StockMovement, product: Product }` (201) | 400, 401, 403, 404, 409 (below zero), 422 (inactive) |
| GET | `/stock/low-stock` | `page`, `limit` | paginated `Product[]` (200; `quantity <= minStock`, active only) | 400, 401, 403 |

`StockMovement`:

```ts
{
  id: string;
  productId: string;
  type: "PURCHASE_RECEIPT" | "SALE" | "RETURN" | "ADJUSTMENT";
  quantityChange: number;   // signed
  quantityAfter: number;
  reason: string | null;
  orderId: string | null;
  purchaseOrderId: string | null;
  createdById: string;
  createdAt: string;
  product: { id: string; name: string; sku: string };
  createdBy: { id: string; name: string };
}
```

- Manual adjustments always write `type: ADJUSTMENT`; `SALE`/`PURCHASE_RECEIPT`/`RETURN`
  are system-generated.
- `POST /stock/adjustments` is one Serializable transaction with a conditional atomic
  update; two concurrent decreases can never push quantity below zero.
- `quantityAfter` is computed server-side and never accepted from the client.

### 8.4 Purchase orders (read/receive)

| Method | Path | Query / body | Response | Statuses / errors |
| --- | --- | --- | --- | --- |
| GET | `/purchase-orders` | `page`, `limit`, `status`, `supplierId`, `sortBy` (`createdAt`\|`status`), `sortOrder` | paginated `PurchaseOrder[]` (200) | 400, 401, 403 |
| GET | `/purchase-orders/:id` | — | `PurchaseOrderDetail` (200) | 400, 401, 403, 404 |
| POST | `/purchase-orders/:id/receive` | `{ items: [{ productId, quantity }] }` (1–100 lines) | `PurchaseOrderDetail` (200) | 400, 401, 403, 404, 409 (over-receive/wrong state), 422 (inactive) |

`PurchaseOrder`:

```ts
{
  id: string;
  orderNumber: string;   // e.g. "PO-0001"
  supplierId: string;
  status: "DRAFT" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
  totalAmount: number;
  expectedAt: string | null;
  receivedAt: string | null;
  notes: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}
```

`PurchaseOrderDetail` adds:

```ts
{
  supplier: { id: string; companyName: string };
  items: Array<{
    id: string;
    purchaseOrderId: string;
    productId: string;
    quantityOrdered: number;
    quantityReceived: number;
    unitCost: number;
    product: { id: string; name: string; sku: string };
  }>;
}
```

- Receiving is full or partial per line. It increments `quantityReceived`, raises
  product stock, writes one `PURCHASE_RECEIPT` movement per line, and moves the status
  to `PARTIALLY_RECEIVED`/`RECEIVED` — all in one transaction.
- Over-receiving is `409`; `DRAFT`/`CANCELLED`/`RECEIVED` orders are `409`; a product
  that is not a line of the order is `400`.
- A committed full receipt fans a best-effort `PURCHASE_ORDER_RECEIVED` notification to
  ADMINs.

---

## 9. ADMIN — management routes

ADMIN holds every permission. These routes are ADMIN-only because no other role has the
required permission.

### 9.1 Admin-only auth probe

| Method | Path | Response | Statuses / errors |
| --- | --- | --- | --- |
| GET | `/auth/admin-only` | `{ message: "Welcome, Admin!" }` (200) | 401, 403 |

### 9.2 Users

| Method | Path | Query / body | Response | Statuses / errors |
| --- | --- | --- | --- | --- |
| GET | `/users` | `page`, `limit`, `search`, `role`, `sortBy` (`name`\|`email`\|`role`\|`isActive`\|`createdAt`\|`updatedAt`), `sortOrder` | paginated `User[]` (200) | 400, 401, 403 |
| GET | `/users/:id` | — | `User` (200) | 400 (invalid id), 401, 403, 404 |
| POST | `/users` | `{ name (2–100), email, password (8–72 bytes), role }` | `User` (201) | 400, 401, 403, 409 |
| PATCH | `/users/:id` | `{ name?, email?, role?, isActive? }` | `User` (200) | 400, 401, 403, 404, 409, 422 |
| DELETE | `/users/:id` | — | 204 empty (soft delete) | 400, 401, 403, 404, 409, 422 |

- `role` is one of `ADMIN`, `STAFF`, `SUPPORT`, `CUSTOMER`; an unknown value is `400`.
- `409` when deactivating/demoting the last active ADMIN or duplicating an email.
- `422` for self-deactivation / self-role-change through `/users/:id`.
- Changing a role or deactivating a user revokes all of their active refresh tokens.
- User responses never include `passwordHash`.

### 9.3 Categories (write)

| Method | Path | Request body | Response | Statuses / errors |
| --- | --- | --- | --- | --- |
| POST | `/categories` | `{ name (1–100), description? (≤5000) }` | `Category` (201) | 400, 401, 403, 409 (duplicate name) |
| PATCH | `/categories/:id` | `{ name?, description?, isActive? }` | `Category` (200) | 400, 401, 403, 404, 409 |
| DELETE | `/categories/:id` | — | 204 empty (soft delete) | 400, 401, 403, 404, 409 (linked products) |

`Category`: `{ id, name, description, isActive, createdAt, updatedAt }`.

### 9.4 Products (write and images)

| Method | Path | Request body | Response | Statuses / errors |
| --- | --- | --- | --- | --- |
| POST | `/products` | `{ sku (≤64), name (≤200), description?, imageUrl?, barcode?, price, costPrice?, quantity?, minStock?, categoryId, supplierId? }` | `Product` (201) | 400, 401, 403, 404 (bad category/supplier), 409 (duplicate sku/barcode) |
| PATCH | `/products/:id` | same fields, all optional; **`quantity` is not editable here** | `Product` (200) | 400, 401, 403, 404, 409 |
| DELETE | `/products/:id` | — | 204 empty (soft delete) | 400, 401, 403, 404 |
| POST | `/products/:id/image` | `multipart/form-data`, field `image` | `Product` (200) with new `imageUrl` | 400 (missing/unsupported), 401, 403, 404, 413 (>2 MB) |
| DELETE | `/products/:id/image` | — | 204 empty | 400, 401, 403, 404 |

`Product`:

```ts
{
  id: string;
  sku: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  barcode: string | null;
  price: number;
  costPrice?: number | null;   // ADMIN only; omitted for every other role
  quantity: number;
  minStock: number;
  isActive: boolean;
  categoryId: string;
  supplierId: string | null;
  createdAt: string;
  updatedAt: string;
}
```

- `price`/`costPrice` are `0..9999999999.99`; negative or over-range values are `400`.
- Deactivation is the soft delete; the row is never removed (AD-001). Deleting a
  product never fails because of linked order/PO items — history keeps its snapshots.
- Product image uploads accept JPEG, PNG or WebP (magic-byte detection) up to **2 MB**.
  `imageUrl` is `null`, an external `https://...` URL, or a relative
  `/uploads/products/<uuid>.<jpg|png|webp>` path.

### 9.5 Suppliers (write)

| Method | Path | Request body | Response | Statuses / errors |
| --- | --- | --- | --- | --- |
| POST | `/suppliers` | `{ companyName (1–200), email?, phone?, address? }` | `Supplier` (201) | 400, 401, 403 |
| PATCH | `/suppliers/:id` | `{ companyName?, email?, phone?, address?, isActive? }` | `Supplier` (200) | 400, 401, 403, 404 |
| DELETE | `/suppliers/:id` | — | 204 empty (soft delete) | 400, 401, 403, 404 |

### 9.6 Purchase orders (create/status)

| Method | Path | Request body | Response | Statuses / errors |
| --- | --- | --- | --- | --- |
| POST | `/purchase-orders` | `{ supplierId, expectedAt?, notes?, items: [{ productId, quantityOrdered, unitCost }] }` (1–100 lines) | `PurchaseOrderDetail` (201, status `DRAFT`) | 400, 401, 403, 404, 409, 422 |
| PATCH | `/purchase-orders/:id/status` | `{ newStatus: "ORDERED" \| "CANCELLED" }` | `PurchaseOrderDetail` (200) | 400, 401, 403, 404, 409 |

- Manual transitions only: `DRAFT → ORDERED`, `DRAFT → CANCELLED`,
  `ORDERED → CANCELLED`. `PARTIALLY_RECEIVED`/`RECEIVED` are receiving outcomes only;
  targeting them is `409`. `RECEIVED`/`CANCELLED` are terminal.
- Creating a PO touches **no stock**; missing supplier/product is `404`, inactive is
  `422`, duplicate `productId` lines are `400`.
- `unitCost` is client input; `totalAmount` is computed server-side with decimal math.

### 9.7 Dashboard

ADMIN-only via `dashboard.read`. Every route takes optional inclusive `from`/`to`
(ISO 8601): both or neither, `from <= to`, at most 92 days — otherwise `400`. Omitted
range = last 30 days. Day buckets are UTC and zero-filled.

| Method | Path | Query | Response | Statuses / errors |
| --- | --- | --- | --- | --- |
| GET | `/dashboard/summary` | `from`, `to` | `{ totalProducts, totalStockUnits, stockValue, lowStockCount, outOfStockCount, ordersInPeriod, revenueInPeriod, period: { from, to } }` (200; all numeric, money as numbers) | 400, 401, 403 |
| GET | `/dashboard/low-stock` | `page`, `limit` | paginated `Product[]` (200) | 400, 401, 403 |
| GET | `/dashboard/sales` | `from`, `to` | `[{ date: "YYYY-MM-DD", totalSales: number, orderCount: number }]` (200) | 400, 401, 403 |
| GET | `/dashboard/top-products` | `from`, `to`, `limit` (1–50, default 5) | `[{ productId, productName, sku, quantitySold, revenue }]` (200) | 400, 401, 403 |
| GET | `/dashboard/stock-movements` | `from`, `to` | `[{ date: "YYYY-MM-DD", unitsIn, unitsOut }]` (200) | 400, 401, 403 |

- `stockValue = SUM(quantity * costPrice)` over active products; NULL cost counts as 0.
- Counts cover active products only.
- `ordersInPeriod`/`revenueInPeriod`/sales/top-products exclude `CANCELLED` orders;
  `PENDING` and `CONFIRMED` both count.

### 9.8 Audit log

| Method | Path | Query | Response | Statuses / errors |
| --- | --- | --- | --- | --- |
| GET | `/audit-logs` | `page`, `limit`, `userId`, `entityType`, `entityId`, `action`, `from`, `to`, `sortBy` (`createdAt`\|`action`), `sortOrder` | paginated `AuditLog[]` (200) | 400, 401, 403 |

`AuditLog`:

```ts
{
  id: string;
  userId: string | null;
  user: { id: string; name: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues: unknown;   // opaque JSON
  newValues: unknown;   // opaque JSON
  createdAt: string;
}
```

- Read-only: there is no POST/PATCH/DELETE route.
- Actions currently written: `product.created|updated|deleted`,
  `product.image_updated|image_deleted`, `stock.adjusted`,
  `order.created|updated|cancelled|viewed`,
  `purchase_order.received`, `contact_message.status_changed`,
  `user.updated|deactivated|password_changed|avatar_updated|avatar_deleted`.
- Sensitive keys (`password`, `*hash*`, `*token*`, `*secret*`, case-insensitive, at any
  depth) are stripped before persisting.
- Audit writes are best effort; a failure never aborts the operation.

### 9.9 Reports (CSV)

ADMIN-only via `reports.read`. Every route answers `200` with
`Content-Type: text/csv; charset=utf-8` and
`Content-Disposition: attachment; filename="<report>.csv"`. Exports contain every
matching row (no pagination; `page`/`limit` are rejected as unknown query params).
CSV is RFC-4180 escaped and text starting with `= + - @` is prefixed with `'`.

| Method | Path | Query | Filename |
| --- | --- | --- | --- |
| GET | `/reports/inventory.csv` | `search`, `categoryId`, `supplierId`, `isActive` (default true), `stockStatus` | `inventory-YYYY-MM-DD.csv` |
| GET | `/reports/low-stock.csv` | — | `low-stock-YYYY-MM-DD.csv` |
| GET | `/reports/sales.csv` | `from`, `to` (both or neither; default last 30 days; max 92 days) | `sales-YYYY-MM-DD_YYYY-MM-DD.csv` |
| GET | `/reports/stock-movements.csv` | `productId`, `type`, `orderId`, `purchaseOrderId`, `from`, `to` | `stock-movements-<range>.csv` |

- **Inventory** columns: `SKU, Name, Category, Supplier, Quantity, Min Stock, Price, Cost Price, Active`.
- **Low stock** columns: `SKU, Name, Category, Supplier, Quantity, Min Stock, Shortfall`.
- **Sales** columns: `Order Number, Created At, Status, Customer, Phone, Items, Total, Created By`;
  `CANCELLED` orders are excluded.
- **Stock movements** columns: `Created At, SKU, Product, Type, Change, Quantity After, Reason, Order Number, Purchase Order Number, Created By`.
- Empty results still return the header row.

---

## 10. Uploads

Two multipart endpoints exist; both use the field name **`image`** and detect the real
file type from magic bytes (never the client filename or MIME type).

| Endpoint | Access | Allowed types | Max size | Stored path |
| --- | --- | --- | --- | --- |
| `POST /users/me/avatar` | any authenticated | JPEG, PNG, WebP | **1 MB** (`413`) | `/uploads/avatars/<uuid>.<ext>` |
| `POST /products/:id/image` | ADMIN (`products.write`) | JPEG, PNG, WebP | **2 MB** (`413`) | `/uploads/products/<uuid>.<ext>` |

- Uploaded files are **public** (no JWT) and served outside `/api/v1`. Resolve relative
  URLs against the API origin, e.g. `http://localhost:3010/uploads/...`.
- Replacing an image deletes the previous local file after the database update; a
  failed database update removes the newly written file. External `https://...` URLs
  are never deleted from disk.
- Missing/unsupported files answer `400`; oversized files answer `413`.

---

## 11. Rate limits

| Scope | Limit |
| --- | --- |
| Global private API default | 100 requests / minute / client |
| `POST /auth/register` | 5 requests / minute / client |
| `POST /orders/mine` | 10 requests / minute / client |
| Public catalog (each route) | 30 requests / minute / client / route |
| `POST /contact` | 5 requests / hour / client |

Limits are enforced by `@nestjs/throttler` (`ThrottlerGuard` runs first). A rejected
request is HTTP `429`; treat it as retryable and back off.

---

## 12. Request / response examples

All tokens below are obviously fake placeholders. Never commit real tokens.

### 12.1 Login

```http
POST /api/v1/auth/login
Content-Type: application/json
```

```json
{ "email": "customer@example.com", "password": "correct-horse-battery" }
```

```json
{
  "accessToken": "fake.access.token",
  "refreshToken": "fake-refresh-token-000000000000000000000000",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Jane Doe",
    "email": "customer@example.com",
    "avatarUrl": null,
    "role": "CUSTOMER"
  }
}
```

### 12.2 Register

```http
POST /api/v1/auth/register
```

```json
{ "name": "Jane Doe", "email": "customer@example.com", "password": "correct-horse-battery" }
```

`201` with the same `Session` shape as login; `user.role` is always `"CUSTOMER"`.
Sending `"role": "ADMIN"` additionally answers `400` (unknown property).

### 12.3 Refresh

```http
POST /api/v1/auth/refresh
```

```json
{ "refreshToken": "fake-refresh-token-000000000000000000000000" }
```

```json
{
  "accessToken": "fake.new.access.token",
  "refreshToken": "fake-rotated-refresh-token-111111111111111111111",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

The old refresh token is now revoked. Replaying it answers `401`.

### 12.4 Public catalog list

```http
GET /api/v1/catalog/products?search=pen&sort=price&order=asc&page=1&limit=10
```

```json
{
  "data": [
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "sku": "OFF-PEN-002",
      "name": "Ballpoint Pen",
      "description": "Blue ink, 0.7 mm",
      "price": 1.99,
      "imageUrl": "/uploads/products/33333333-3333-4333-8333-333333333333.webp",
      "category": { "id": "44444444-4444-4444-8444-444444444444", "name": "Stationery" },
      "inStock": true,
      "maxOrderable": 20
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

### 12.5 Public catalog detail

```http
GET /api/v1/catalog/products/22222222-2222-4222-8222-222222222222
```

```json
{
  "id": "22222222-2222-4222-8222-222222222222",
  "sku": "OFF-PEN-002",
  "name": "Ballpoint Pen",
  "description": "Blue ink, 0.7 mm",
  "price": 1.99,
  "imageUrl": null,
  "category": { "id": "44444444-4444-4444-8444-444444444444", "name": "Stationery" },
  "inStock": true,
  "maxOrderable": 20
}
```

Inactive products and products in inactive categories return `404` with the same body.

### 12.6 Create a customer order

```http
POST /api/v1/orders/mine
Authorization: Bearer fake.access.token
```

```json
{
  "items": [{ "productId": "22222222-2222-4222-8222-222222222222", "quantity": 2 }],
  "recipientName": "Jane Doe",
  "recipientPhone": "+201005551234",
  "shippingAddress": "12 Nile Street, Apt 4",
  "shippingCity": "Cairo",
  "notes": "Please call on arrival"
}
```

```json
{
  "id": "55555555-5555-4555-8555-555555555555",
  "orderNumber": "ORD-0001",
  "status": "PENDING",
  "totalAmount": 3.98,
  "items": [
    {
      "productName": "Ballpoint Pen",
      "sku": "OFF-PEN-002",
      "quantity": 2,
      "unitPrice": 1.99,
      "lineTotal": 3.98
    }
  ],
  "recipientName": "Jane Doe",
  "recipientPhone": "+201005551234",
  "shippingAddress": "12 Nile Street, Apt 4",
  "shippingCity": "Cairo",
  "paymentMethod": "COD",
  "createdAt": "2026-10-30T14:30:00.000Z",
  "cancelledAt": null
}
```

### 12.7 List my orders

```http
GET /api/v1/orders/mine?page=1&limit=20&status=PENDING
Authorization: Bearer fake.access.token
```

```json
{
  "data": [
    {
      "id": "55555555-5555-4555-8555-555555555555",
      "orderNumber": "ORD-0001",
      "status": "PENDING",
      "totalAmount": 3.98,
      "items": [
        {
          "productName": "Ballpoint Pen",
          "sku": "OFF-PEN-002",
          "quantity": 2,
          "unitPrice": 1.99,
          "lineTotal": 3.98
        }
      ],
      "recipientName": "Jane Doe",
      "recipientPhone": "+201005551234",
      "shippingAddress": "12 Nile Street, Apt 4",
      "shippingCity": "Cairo",
      "paymentMethod": "COD",
      "createdAt": "2026-10-30T14:30:00.000Z",
      "cancelledAt": null
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

### 12.8 Order detail: staff vs customer

Customer (`GET /orders/mine/:id`, CUSTOMER token) returns only the `CustomerOrder`
allow-list shown above. It never contains internal ids, notes, staff, stock or audit
data.

Staff/SUPPORT (`GET /orders/:id`, SUPPORT/STAFF/ADMIN token) returns the operational
order plus items, creator and stock movements:

```json
{
  "id": "55555555-5555-4555-8555-555555555555",
  "orderNumber": "ORD-0001",
  "status": "PENDING",
  "customerName": "Jane Doe",
  "customerPhone": "+201005551234",
  "notes": "Please call on arrival",
  "totalAmount": 3.98,
  "customerId": "11111111-1111-4111-8111-111111111111",
  "recipientName": "Jane Doe",
  "recipientPhone": "+201005551234",
  "shippingAddress": "12 Nile Street, Apt 4",
  "shippingCity": "Cairo",
  "paymentMethod": "COD",
  "createdById": "11111111-1111-4111-8111-111111111111",
  "cancelledAt": null,
  "createdAt": "2026-10-30T14:30:00.000Z",
  "updatedAt": "2026-10-30T14:30:00.000Z",
  "items": [
    {
      "id": "66666666-6666-4666-8666-666666666666",
      "orderId": "55555555-5555-4555-8555-555555555555",
      "productId": "22222222-2222-4222-8222-222222222222",
      "productName": "Ballpoint Pen",
      "sku": "OFF-PEN-002",
      "quantity": 2,
      "unitPrice": 1.99,
      "lineTotal": 3.98
    }
  ],
  "createdBy": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Jane Doe",
    "email": "customer@example.com"
  },
  "stockMovements": [
    {
      "id": "77777777-7777-4777-8777-777777777777",
      "productId": "22222222-2222-4222-8222-222222222222",
      "type": "SALE",
      "quantityChange": -2,
      "quantityAfter": 18,
      "reason": null,
      "createdAt": "2026-10-30T14:30:00.000Z"
    }
  ]
}
```

Differences to rely on: the customer body has no `customerId`, `createdById`,
`createdBy`, `customerName`, `customerPhone`, `notes`, item ids/`productId`,
`stockMovements` or `updatedAt`.

### 12.9 Contact submission

```http
POST /api/v1/contact
```

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "subject": "Question about my order",
  "message": "Hello, I need help with...",
  "honeypot": ""
}
```

```json
{ "received": true }
```

### 12.10 Contact inbox item (SUPPORT/ADMIN)

```http
GET /api/v1/contact-messages/88888888-8888-4888-8888-888888888888
Authorization: Bearer fake.support.token
```

```json
{
  "id": "88888888-8888-4888-8888-888888888888",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "subject": "Question about my order",
  "message": "Hello, I need help with...",
  "status": "NEW",
  "assignedToId": null,
  "assignedTo": null,
  "internalNote": null,
  "createdAt": "2026-10-30T14:31:00.000Z",
  "updatedAt": "2026-10-30T14:31:00.000Z"
}
```

Triage (`PATCH /contact-messages/:id`):

```json
{
  "status": "IN_PROGRESS",
  "assignedToId": "99999999-9999-4999-8999-999999999999",
  "internalNote": "Calling the customer back."
}
```

### 12.11 Order notes (SUPPORT/STAFF/ADMIN)

```http
POST /api/v1/orders/55555555-5555-4555-8555-555555555555/notes
Authorization: Bearer fake.support.token
```

```json
{ "note": "Customer called about the delivery date." }
```

```json
{
  "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "orderId": "55555555-5555-4555-8555-555555555555",
  "authorId": "99999999-9999-4999-8999-999999999999",
  "note": "Customer called about the delivery date.",
  "author": { "id": "99999999-9999-4999-8999-999999999999", "name": "Sam Support" },
  "createdAt": "2026-10-30T15:00:00.000Z"
}
```

`GET /orders/:id/notes` returns an array of these, oldest first. These notes never
appear in `/orders/mine` responses.

### 12.12 Notifications list

```http
GET /api/v1/notifications?unread=true&type=ORDER_CONFIRMED&page=1&limit=20
Authorization: Bearer fake.access.token
```

```json
{
  "data": [
    {
      "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "userId": "11111111-1111-4111-8111-111111111111",
      "type": "ORDER_CONFIRMED",
      "title": "Order confirmed",
      "message": "Order ORD-0001 is now CONFIRMED.",
      "entityType": "order",
      "entityId": "55555555-5555-4555-8555-555555555555",
      "data": null,
      "isRead": false,
      "readAt": null,
      "createdAt": "2026-10-30T15:10:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

---

## 13. Statuses & transitions (reference)

**Order statuses:** only `PENDING`, `CONFIRMED`, `CANCELLED` exist.

```text
PENDING ──confirm──▶ CONFIRMED
   │                    │
   └──────cancel────────┴──▶ CANCELLED (terminal)
```

- Confirm: `PATCH /orders/:id/status` with `newStatus: "CONFIRMED"` (STAFF/ADMIN only).
- Cancel `PENDING`: `PATCH /orders/:id/status` with `newStatus: "CANCELLED"` or
  `POST /orders/:id/cancel` (SUPPORT/STAFF/ADMIN) or `POST /orders/mine/:id/cancel`
  (owner customer).
- Cancel `CONFIRMED`: `PATCH /orders/:id/status` only (STAFF/ADMIN).
- Every other transition, including same-status writes and anything from `CANCELLED`,
  answers `409`. There is **no** `POST /orders/:id/confirm` route. Cancellation requests
  have no body and no required reason.
- Stock is deducted at `PENDING` creation and fully restored on cancellation (AD-002).

**PurchaseOrder statuses:** `DRAFT`, `ORDERED`, `PARTIALLY_RECEIVED`, `RECEIVED`,
`CANCELLED`.

- Manual: `DRAFT → ORDERED`, `DRAFT → CANCELLED`, `ORDERED → CANCELLED` via
  `PATCH /purchase-orders/:id/status`.
- `PARTIALLY_RECEIVED`/`RECEIVED` happen only through `POST /purchase-orders/:id/receive`.
- `RECEIVED` and `CANCELLED` are terminal.

---

## 14. Frontend integration notes

- **Customer storefront / cart / checkout** must use `GET /catalog/products`,
  `GET /catalog/products/:id`, `GET /catalog/categories`, `POST /orders/mine`,
  `GET /orders/mine`, `GET /orders/mine/:id` and `POST /orders/mine/:id/cancel`.
  Do **not** post checkout to `POST /orders` — that is the staff till and requires
  `orders.create`.
- **Staff till** uses `GET /products`, `POST /orders`, `GET /orders`, `GET /orders/:id`,
  `PATCH /orders/:id`, `PATCH /orders/:id/status`, `POST/GET /orders/:id/notes`,
  suppliers, stock and purchase-order routes.
- **Support console** uses `GET /orders` (rows arrive without phone/address),
  `GET /orders/:id` (full PII; audited), `POST /orders/:id/cancel` (PENDING only),
  the order-notes routes and `/contact-messages`.
- **Admin console** additionally uses `/users`, product/category/supplier writes,
  product image upload, PO create/status, `/dashboard/*`, `/audit-logs` and
  `/reports/*`.
- **Never show customers** `customerId`, `createdById`, `createdBy`, `customerName`,
  `customerPhone`, the legacy `notes`, internal order notes, `stockMovements`,
  `costPrice`, `minStock`, exact `quantity`, `barcode`, `supplier`, `isActive` or audit
  data. Render only the `CustomerOrder` allow-list.
- **Auth:** store both tokens; send `Authorization: Bearer <accessToken>`; refresh with
  `POST /auth/refresh` before/after `expiresIn` (900 s). Refresh rotates the token, so
  replace the stored refresh token with the returned one. A `401` means re-login.
- **Roles:** type all four roles. Treat `ADMIN` as a superset. Do not hard-code
  `ADMIN`/`STAFF` only (the current frontend types still do — update them when
  consuming this contract).
- **Money:** all money fields are JSON numbers. Format/round in the UI; do not
  `parseFloat` a string or append `.00` on the wire.
- **Pagination:** read `data` and `meta`; default `page=1`, `limit=20`, max 100
  (50 for public catalog).
- **Uploads:** use `FormData` with field `image`; enforce the 1 MB avatar / 2 MB product
  limit client-side for good UX, but rely on the server's `400`/`413`. Resolve relative
  `/uploads/...` URLs against the backend origin (`http://localhost:3010` in dev), not
  `/api/v1`.
- **Dev proxy:** Vite runs on `5173` and proxies `/api` and `/uploads` to
  `http://localhost:3010`. A different backend port requires updating
  `frontend/vite.config.ts`.
- **429 / 403:** `429` is retryable with backoff. `403` means the role lacks the
  permission; `404` on own-order/notification routes often means "not yours" by design.
- **Notifications:** poll `GET /notifications/unread-count`; fetch the list on demand.
  Customer status messages carry `entityType: "order"` and `entityId`; deep-link to
  `/orders/mine/:id`.

---

## 15. Frontend safe assumptions

- Any response field not shown here must be ignored by the frontend, not depended on.
- New fields may be added to responses without a major version bump; breaking changes
  go to `/api/v2`.
- The frontend may generate mock data against this file directly; every page should be
  achievable with no backend running, using the shapes above.

---

## 16. Approval

| Role     | Name | Reviewed (date) | Sign-off |
| -------- | ---- | --------------- | -------- |
| Backend  | —    | —               | —        |
| Frontend | —    | —               | —        |

Fill this in via PR review. Contract changes after sign-off require a new PR touching
this file.
