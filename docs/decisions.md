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

All `/dashboard/*` routes are **ADMIN-only** (`@Roles('ADMIN')`). The payloads expose revenue and cost-basis stock value, which AD-004 keeps off STAFF screens; a separate STAFF view is deliberately not provided in v1.

- **Stock value basis:** `SUM(quantity * costPrice)` over **active** products, with a NULL `costPrice` counting as 0. The price-based alternative (`quantity * price`) would overstate inventory worth; cost matches what the shop actually invested. The docs and Swagger say so explicitly.
- **Counts** (`totalProducts`, `totalStockUnits`, `lowStockCount`, `outOfStockCount`) cover active products only.
- **Revenue/sales/top-products** exclude `CANCELLED` orders and include `PENDING` + `CONFIRMED` (stock leaves at creation — AD-002), so figures agree with the movement history.
- **Ranges:** optional `from`/`to` (both or neither; default last 30 days; `from <= to`; at most **92 days**) — violations are 400. Day buckets are UTC and every day in the range is present (zero-filled), so charts never need gap handling.
- **Query choice:** Prisma `aggregate`/`groupBy`/`count` first; `$queryRaw` only for what Prisma cannot express — the two column-math expressions and UTC `date_trunc` grouping — always parameterized with no string interpolation of user input.
