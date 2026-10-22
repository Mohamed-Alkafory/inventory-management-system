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
  `POST /auth/refresh`, `GET /health`.

### Roles

- `ADMIN` and `STAFF` (Prisma `UserRole`).
- `ADMIN` includes everything `STAFF` can do.
- "Role required" column below: `any` = any authenticated user; `admin` = ADMIN only.

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

| Field         | Type                | Always present | Notes                                                          |
| ------------- | ------------------- | -------------- | -------------------------------------------------------------- |
| `statusCode`  | number              | yes            | HTTP status, duplicated in the body                            |
| `message`     | string \| string[]  | yes            | Human-readable summary; arrays allowed (Nest default)          |
| `error`       | string              | yes            | Machine-readable error `CODE` (see table)                      |
| `fieldErrors` | Record<string, string[]> | no        | Only for validation errors; maps JSON key → messages           |
| `path`        | string              | yes            | Request URL                                                    |
| `timestamp`   | string              | yes            | ISO 8601 UTC                                                   |

Error codes:

| Code                   | HTTP | Meaning                                        |
| ---------------------- | ---- | ---------------------------------------------- |
| `VALIDATION_ERROR`     | 400  | Body/query failed Zod/class-validator checks   |
| `UNAUTHORIZED`         | 401  | Missing/expired/invalid token                  |
| `FORBIDDEN`            | 403  | Authenticated but role insufficient            |
| `NOT_FOUND`            | 404  | Resource does not exist                        |
| `CONFLICT`             | 409  | Duplicate unique field (e.g. SKU, email)       |
| `BUSINESS_RULE_ERROR`  | 422  | Semantically invalid (e.g. stock below zero, invalid status transition) |
| `INTERNAL_ERROR`       | 500  | Unexpected server failure                      |
| `SERVICE_UNAVAILABLE`  | 503  | Database or dependency down                    |

---

## 3. Endpoints

Legend: 🔓 public · Role: `any` / `admin` · Paginated unless marked "no pagination".

### 3.1 Auth

| Method | Path              | Role | Request body                                   | Response                                          | Errors                          |
| ------ | ----------------- | ---- | ---------------------------------------------- | ------------------------------------------------- | ------------------------------- |
| POST 🔓 | `/auth/login`     | —    | `{ email, password }`                          | `{ user: User, accessToken, refreshToken }`       | 400, 401                        |
| POST 🔓 | `/auth/register`  | —    | `{ name, email, password }`                    | `{ user: User, accessToken, refreshToken }`       | 400, 409                        |
| POST 🔓 | `/auth/refresh`   | —    | `{ refreshToken }`                             | `{ accessToken, refreshToken }`                   | 400, 401                        |
| POST    | `/auth/logout`    | any  | `{ refreshToken }`                             | `204` (empty)                                     | 401                             |
| GET     | `/auth/me`        | any  | —                                              | `User` (no `passwordHash`)                        | 401                             |
| PATCH   | `/auth/me`        | any  | `{ name?, password?{ current, next } }`        | `User`                                            | 400, 401, 422                   |

`User` shape: `{ id, name, email, role, isActive, createdAt, updatedAt }` — `passwordHash` is **never** returned by any endpoint.

When `register` is disabled in config (ADMIN-created accounts only) it returns `403 FORBIDDEN` — decide at implementation; frontend should not rely on it.

### 3.2 Users

| Method | Path                  | Role  | Request body                                              | Response                     | Errors           |
| ------ | --------------------- | ----- | --------------------------------------------------------- | ---------------------------- | ---------------- |
| GET    | `/users`              | admin | `?page&limit&search&role&sortBy&sortOrder`                | paginated `User[]`           | 401, 403         |
| GET    | `/users/:id`          | admin | —                                                         | `User`                       | 401, 403, 404    |
| POST   | `/users`              | admin | `{ name, email, password, role }`                         | `User` (201)                 | 400, 401, 403, 409 |
| PATCH  | `/users/:id`          | admin | `{ name?, email?, role?, isActive? }`                     | `User`                       | 400, 403, 404, 409, 422 |
| DELETE | `/users/:id`          | admin | —                                                         | `204` (soft delete, see decisions) | 401, 403, 404, 422 |

Error cases: `422` when deactivating the last active ADMIN, or self-deactivation `/self-role-change`.

### 3.3 Categories

| Method | Path                    | Role | Request body                                    | Response                             | Errors           |
| ------ | ----------------------- | ---- | ----------------------------------------------- | ------------------------------------ | ---------------- |
| GET    | `/categories`           | any  | `?page&limit&search&isActive` / `?all=true`     | paginated `Category[]` (or bare array with `all=true`, no pagination) | 401, 403 |
| GET    | `/categories/:id`       | any  | —                                               | `Category` + `productCount`          | 401, 404         |
| POST   | `/categories`           | admin | `{ name, description? }`                       | `Category` (201)                     | 400, 401, 403, 409 |
| PATCH  | `/categories/:id`       | admin | `{ name?, description?, isActive? }`            | `Category`                           | 400, 401, 403, 404, 409, 422 |
| DELETE | `/categories/:id`       | admin | —                                               | `204` (soft delete)                  | 401, 403, 404, 422 |

`Category`: `{ id, name, description, isActive, createdAt, updatedAt }`.
Errors: `422` when deactivating a category that still has active products (or force-deletes products too — see decisions §1).

### 3.4 Products

| Method | Path                        | Role | Request body / query                                                                                                                   | Response                          | Errors                          |
| ------ | --------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------- |
| GET    | `/products`                 | any  | `?page&limit&search&categoryId&supplierId&isActive&stockStatus(in_stock,low_stock,out_of_stock)&sortBy(name,sku,price,quantity,createdAt)&sortOrder` | paginated `Product[]`             | 400, 401                        |
| GET    | `/products/:id`             | any  | —                                                                                                                                      | `Product` + `{ category, supplier }` populated          | 401, 404 |
| POST   | `/products`                 | admin | `{ sku, name, description?, imageUrl?, barcode?, price, costPrice?, quantity?, minStock?, categoryId, supplierId? }`                   | `Product` (201)                   | 400, 401, 403, 404 (bad categoryId/supplierId), 409 (duplicate sku/barcode) |
| PATCH  | `/products/:id`             | admin | same fields, all optional — **`quantity` not directly editable, use `/stock`**                                                           | `Product`                         | 400, 401, 403, 404, 409, 422 |
| DELETE | `/products/:id`             | admin | —                                                                                                                                      | `204` (soft delete)               | 401, 403, 404, 422 |

`Product` shape: `{ id, sku, name, description, imageUrl, barcode, price, costPrice, quantity, minStock, isActive, categoryId, supplierId, createdAt, updatedAt }`.

- `costPrice` is included **only** for ADMIN (see decisions §4). STAFF responses omit the field entirely (not `null`).
- `stockStatus=low_stock` filters `quantity <= minStock`; `in_stock` → `quantity > 0`;
  `out_of_stock` → `quantity = 0` (drives dashboard + notifications).
  Invalid query values are rejected with `400 VALIDATION_ERROR`.
- Errors: `422` when price/cost validation fails (`price < 0`, `costPrice < 0`), or when deleting a product referenced by an active order/purchase order item.

### 3.5 Suppliers

| Method | Path                  | Role  | Request body / query                                       | Response                           | Errors                          |
| ------ | --------------------- | ----- | ---------------------------------------------------------- | ---------------------------------- | ------------------------------- |
| GET    | `/suppliers`          | any   | `?page&limit&search&isActive` / `?all=true`                | paginated `Supplier[]`             | 401                             |
| GET    | `/suppliers/:id`      | any   | —                                                          | `Supplier` + `productCount`        | 401, 404                        |
| POST   | `/suppliers`          | admin | `{ companyName, email?, phone?, address? }`                | `Supplier` (201)                   | 400, 401, 403                   |
| PATCH  | `/suppliers/:id`      | admin | `{ companyName?, email?, phone?, address?, isActive? }`    | `Supplier`                         | 400, 401, 403, 404, 422         |
| DELETE | `/suppliers/:id`      | admin | —                                                          | `204` (soft delete)                | 401, 403, 404, 422              |

`Supplier`: `{ id, companyName, email, phone, address, isActive, createdAt, updatedAt }`.

### 3.6 Stock

| Method | Path                                  | Role  | Request body                                                        | Response                        | Errors                            |
| ------ | ------------------------------------- | ----- | ------------------------------------------------------------------- | ------------------------------- | --------------------------------- |
| GET    | `/stock/movements`                    | any   | `?page&limit&productId&type&orderId&purchaseOrderId&sortBy&sortOrder` | paginated `StockMovement[]`    | 401                               |
| POST   | `/stock/adjustments`                  | any   | `{ productId, quantityChange, reason }` (quantityChange ≠ 0)        | `{ movement: StockMovement, product: Product }` (201) | 400, 401, 403 (see below), 404, 422 |
| GET    | `/stock/low-stock`                    | any   | `?page&limit`                                                        | paginated `Product[]` (`quantity <= minStock`, active only) | 401 |

- `StockMovement` shape: `{ id, productId, type, quantityChange, quantityAfter, reason, orderId, purchaseOrderId, createdById, createdAt }`.
- `type` on adjustments is always `ADJUSTMENT`; `SALE`/`PURCHASE_RECEIPT`/`RETURN` are system-generated from orders/purchase orders.
- Role: STAFF may adjust stock (they run the till); `RETURN` and other system types cannot be created manually.
- Errors: `422` when the resulting quantity would go below 0, or `quantityChange = 0`.
- Product quantity and the movement row are written in **one transaction** (`quantityAfter` computed server-side, never sent by client).

### 3.7 Orders

| Method | Path                      | Role | Request body / query                                                             | Response                                   | Errors                                            |
| ------ | ------------------------- | ---- | -------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------- |
| GET    | `/orders`                 | any  | `?page&limit&status&search(customerName,orderNumber)&createdById&sortBy(status,createdAt)&sortOrder` | paginated `Order[]`          | 401                                               |
| GET    | `/orders/:id`             | any  | —                                                                                | `Order` + `items[]` + `createdBy`          | 401, 404                                          |
| POST   | `/orders`                 | any  | `type CreateOrderRequest = { items: Array<{ productId: string; quantity: number }>; customerName?: string; customerPhone?: string; notes?: string; }` | `Order` + `items` (201) | 400, 401, 404 (product not found / inactive), 422 (insufficient stock) |
| PATCH  | `/orders/:id`             | any  | `{ customerName?, customerPhone?, notes? }` — only while `PENDING`               | `Order`                                    | 401, 404, 422 (not editable after PENDING)        |
| POST   | `/orders/:id/confirm`     | any  | —                                                                                | `Order` (status → `CONFIRMED`)             | 401, 404, 409 (already transitioned), 422         |
| POST   | `/orders/:id/cancel`     | any  | `{ reason }`                                                                     | `Order` (status → `CANCELLED`)             | 401, 404, 409, 422                                |

- `Order` shape: `{ id, orderNumber, status, customerName, customerPhone, notes, totalAmount, createdById, cancelledAt, createdAt, updatedAt, items?: OrderItem[] }`.
- `OrderItem` shape: `{ id, orderId, productId, productName, sku, quantity, unitPrice, lineTotal }` — snapshots, client must not expect them to track later product edits.
- `totalAmount` is always computed server-side from the item snapshots' `unitPrice`; client-sent prices are ignored.
- **Stock is deducted at `PENDING` creation** and fully restored on cancel (see decisions §2).
- Errors: `422` when confirming a PENDING order whose stock somehow became unavailable, cancelling a `CONFIRMED` order without permission, or transitioning from a terminal (`CANCELLED`) state.

### 3.8 Purchase orders

| Method | Path                                   | Role  | Request body / query                                                                                              | Response                                                  | Errors                          |
| ------ | -------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------- |
| GET    | `/purchase-orders`                     | any   | `?page&limit&status&supplierId&search(orderNumber)&sortBy(status,createdAt)&sortOrder`                             | paginated `PurchaseOrder[]`                               | 401                             |
| GET    | `/purchase-orders/:id`                 | any   | —                                                                                                                 | `PurchaseOrder` + `items[]` + supplier                    | 401, 404                        |
| POST   | `/purchase-orders`                     | admin | `{ supplierId, expectedAt?, notes?, items: [{ productId, quantityOrdered, unitCost }] }`                          | `PurchaseOrder` (201, status `DRAFT`)                     | 400, 401, 403, 404, 422         |
| POST   | `/purchase-orders/:id/order`           | admin | —                                                                                                                 | `PurchaseOrder` (status → `ORDERED`)                      | 401, 403, 404, 409, 422         |
| POST   | `/purchase-orders/:id/receive`         | any   | `{ items: [{ itemId, quantityReceived }] }` (per-item partial receive)                                            | `PurchaseOrder` (status → `PARTIALLY_RECEIVED`/`RECEIVED`) | 401, 404, 409 (not ORDERED/PARTIALLY_RECEIVED), 422 (over-receipt) |
| PATCH  | `/purchase-orders/:id`                 | admin | `{ supplierId?, expectedAt?, notes?, items? }` — only while `DRAFT`                                               | `PurchaseOrder`                                           | 401, 403, 404, 422              |
| POST   | `/purchase-orders/:id/cancel`         | admin | `{ reason }` — only while `DRAFT`/`ORDERED`                                                                       | `PurchaseOrder` (status → `CANCELLED`)                    | 401, 403, 404, 409, 422         |
| DELETE | `/purchase-orders/:id`                 | admin | —                                                                                                                 | `204` (soft delete; only if `DRAFT`/`CANCELLED`)          | 401, 403, 404, 422              |

- `PurchaseOrder` shape: `{ id, orderNumber, supplierId, status, totalAmount, expectedAt, receivedAt, notes, createdById, createdAt, updatedAt, items?: PurchaseOrderItem[] }`.
- `PurchaseOrderItem`: `{ id, purchaseOrderId, productId, quantityOrdered, quantityReceived, unitCost }`.
- Receiving creates `PURCHASE_RECEIPT` stock movements per item and **adds** to product quantity in the same transaction.
- Errors: `422` receive would exceed `quantityOrdered` for an item, or draft edits after `ORDERED`.

### 3.9 Notifications

| Method | Path                                    | Role | Request body / query                            | Response                                | Errors        |
| ------ | --------------------------------------- | ---- | ----------------------------------------------- | --------------------------------------- | ------------- |
| GET    | `/notifications`                        | any  | `?page&limit&isRead&type&sortBy&sortOrder`      | paginated `Notification[]` (own only)   | 401           |
| GET    | `/notifications/unread-count`           | any  | —                                               | `{ count: number }`                     | 401           |
| PATCH  | `/notifications/:id/read`               | any  | —                                               | `Notification` (sets `isRead`, `readAt`) | 401, 404 (not own) |
| PATCH  | `/notifications/read-all`               | any  | —                                               | `{ updated: number }`                   | 401           |
| DELETE | `/notifications/:id`                    | any  | —                                               | `204` (own only)                        | 401, 404      |
| GET    | `/notification-preferences`             | any  | —                                               | `NotificationPreference[]`              | 401           |
| PATCH  | `/notification-preferences`             | any  | `[{ type, enabled }]`                           | `NotificationPreference[]`              | 400, 401      |

`Notification` shape: `{ id, userId, type, title, message, entityType, entityId, data, isRead, readAt, createdAt }`.
Users only ever see their **own** notifications (404 for others'). Delivery: polling `unread-count` (60s) initially; upgrade path noted in §4 of the roadmap.

### 3.10 Dashboard

| Method | Path                          | Role        | Response                                                                                       | Errors        |
| ------ | ----------------------------- | ----------- | ---------------------------------------------------------------------------------------------- | ------------- |
| GET    | `/dashboard/summary`          | any         | `{ totalProducts, lowStockProducts, activeOrders, pendingOrders, todaySales, todayOrders, lowStockItems: Product[], recentOrders: Order[] }` | 401 |
| GET    | `/dashboard/sales-trend`      | admin       | `?days=7|30` → `[{ date: 'YYYY-MM-DD', totalSales: '0.00', orderCount }]`                      | 401, 403      |
| GET    | `/dashboard/top-products`     | any         | `?limit=5` → `[{ productId, productName, sku, quantitySold, revenue }]`                        | 401           |
| GET    | `/dashboard/low-stock`        | any         | `?page&limit` → alias of `/stock/low-stock` (kept for dashboard page)                          | 401           |

`todaySales` counts CONFIRMED orders by `createdAt` (server timezone = UTC), excludes CANCELLED.

### 3.11 Audit log

| Method | Path               | Role  | Request query                                                     | Response                          | Errors        |
| ------ | ------------------ | ----- | ----------------------------------------------------------------- | --------------------------------- | ------------- |
| GET    | `/audit-logs`      | admin | `?page&limit&userId&entityType&entityId&action&from&to&sortBy&sortOrder` | paginated `AuditLog[]`      | 401, 403      |

- `AuditLog` shape: `{ id, userId, action, entityType, entityId, oldValues, newValues, createdAt }` (`oldValues`/`newValues` are opaque JSON objects; `userId` may be `null` for deleted users).
- Audit logs are **read-only** via the API — created server-side, never manually.
- Write coverage: every create/update/delete on products, categories, suppliers, users, orders, purchase orders (mutations by service layer, not DB triggers).

### 3.12 Misc

| Method | Path      | Role | Response                            | Errors |
| ------ | --------- | ---- | ----------------------------------- | ------ |
| GET 🔓 | `/health` | —    | `{ status: 'ok', db: 'up'|'down' }` | —      |

---

## 4. Statuses & transitions (reference)

**Order:** `PENDING → CONFIRMED` (deducts nothing extra; stock leaves at creation)
`PENDING|CONFIRMED → CANCELLED` (restores stock on cancel; terminal, no further transitions)
**PurchaseOrder:** `DRAFT → ORDERED → PARTIALLY_RECEIVED → RECEIVED`, and `DRAFT|ORDERED → CANCELLED`.
`RECEIVED`/`CANCELLED` are terminal.

---

## 5. Frontend safe assumptions

- Any response not shown here (extra fields) must be ignored by the frontend, not depended on.
- New fields may be added to responses without a major version bump; breaking changes go to `/api/v2`.
- Rate limiting: not in v1; treat 429 as retryable `INTERNAL_ERROR` placeholder shape.
- The frontend may generate mock data against this file directly; every page should be achievable with no backend running.

---

## 6. Approval

| Role      | Name | Reviewed (date) | Sign-off |
| --------- | ---- | --------------- | -------- |
| Backend   | —    | —               | —        |
| Frontend  | —    | —               | —        |

Fill this in via PR review. Contract changes after sign-off require a new PR touching this file.
