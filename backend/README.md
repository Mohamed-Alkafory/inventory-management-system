# Backend — NestJS API

NestJS 12 + TypeScript REST API with Prisma 7 (PostgreSQL) and Vitest.
Full local setup lives in the [root README](../README.md); this file is the
backend cheat sheet.

## Setup

```bash
# From the repo root:
cp .env.example .env
cp backend/.env.example backend/.env
docker compose up -d

# From backend/:
npm ci
npx prisma validate
```

Env vars used: `DATABASE_URL` (Prisma runtime connection, must match the container
credentials), `DIRECT_URL` (optional; the Prisma CLI uses it first — set the Neon
direct URL in production), `PORT` (API port; local development uses `3010`),
`CORS_ORIGIN` (comma-separated allowed origins; required), `JWT_SECRET` (signs
access tokens; required, and in production it must be at least 32 characters and
not a placeholder), `JWT_EXPIRES_IN` (access-token lifetime, default `15m`),
`SWAGGER_ENABLED` (optional), `TRUST_PROXY` (optional proxy hop count),
`PG_POOL_MAX` / `PG_CONNECTION_TIMEOUT_MS` / `PG_IDLE_TIMEOUT_MS` (optional pool
tuning), `UPLOADS_DIR` (optional), and `IMAGE_STORAGE` + `CLOUDINARY_*` (optional
image backend). Details in the
[root README](../README.md#deployment-free-tier) and
[`backend/.env.example`](.env.example).

## Scripts (all run from `backend/`)

| Command | What it does |
|---|---|
| `npm run start:dev` | Run API in watch mode (daily development) |
| `npm run start:debug` | Watch mode with debugger |
| `npm run start` | Single run |
| `npm run build` | Production build into `dist/` |
| `npm run start:prod` | Run the built output (after `npm run build`) |
| `npm test` | Unit tests — Vitest (`**/*.spec.ts`) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:cov` | Unit tests with coverage |
| `npm run test:e2e` | E2E tests — Vitest (`**/*.e2e-spec.ts`) |
| `npm run lint` | oxlint over `src/` and `test/` |
| `npm run format` | Prettier over `src/` and `test/` |

E2E tests need a dedicated database whose name contains `test` (default:
`inventory_test`). The test helper refuses to truncate any other database.
Set `E2E_DATABASE_URL` to override the default test connection.

### Role permission matrix suite

`test/role-permission-matrix.e2e-spec.ts` is the consolidated authorization
contract: it asserts the expected 2xx/401/403 outcome for unauthenticated,
CUSTOMER, SUPPORT, STAFF and ADMIN callers on every registered route, and it
fails if a route is added without a matrix entry. It also covers cross-customer
isolation, public registration, SUPPORT limits, catalog privacy, order-note
exclusion, detail-view auditing and last-active-ADMIN protection.

It uses the real PostgreSQL test database (like the inventory suite), so make
sure the test database is running and migrated:

```bash
# From backend/, with the test database available:
npm run test:e2e -- test/role-permission-matrix.e2e-spec.ts
```

Set `E2E_DATABASE_URL` to point at a dedicated test database; the helper
refuses to truncate a database whose name does not contain `test`.

Health checks: `GET http://localhost:3010/api/v1/health/live` →
`{"status":"ok"}` (liveness; no database access) and
`GET http://localhost:3010/api/v1/health` → `{"status":"ok","db":"up"}`
(readiness; runs `SELECT 1`).

## Prisma

- Schema: `prisma/schema.prisma` (Core models implemented).
- Connection: `prisma.config.ts` uses `DIRECT_URL` when set and falls back to
  `DATABASE_URL`, so the CLI (migrate/seed) can use Neon's direct URL while the
  app runtime keeps the pooled `DATABASE_URL`.
- Validate: `npx prisma validate` (from `backend/`).
- Migrations: `npx prisma migrate dev`, then `npx prisma generate` (client output: `src/generated/prisma/`, git-ignored). The production image runs
  `prisma migrate deploy` on container start; never run `prisma db seed` there.

## Reference

- [NestJS docs](https://docs.nestjs.com)
- [Prisma docs](https://www.prisma.io/docs)
- [Vitest docs](https://vitest.dev)
- CI runs `npm ci` → `npx prisma generate` → `npx prisma validate` →
  `npm run lint` → `npm test` → `npx prisma migrate deploy` → `npm run test:e2e`
  → `npm run build` here (`.github/workflows/ci.yml`).
