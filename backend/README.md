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

Env vars used: `DATABASE_URL` (Prisma, must match the container credentials),
`PORT` (API port; local development uses `3010`), `JWT_SECRET` (reserved for upcoming
auth — no code reads it yet). Details in the
[root README](../README.md#environment-variables).

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

Health check: `GET http://localhost:3010/api/v1/health` → `{"status":"ok","db":"up"}`.

## Prisma

- Schema: `prisma/schema.prisma` (Core models implemented).
- Connection: `prisma.config.ts` reads `DATABASE_URL` from `backend/.env`.
- Validate: `npx prisma validate` (from `backend/`).
- Migrations: `npx prisma migrate dev`, then `npx prisma generate` (client output: `src/generated/prisma/`, git-ignored).

## Reference

- [NestJS docs](https://docs.nestjs.com)
- [Prisma docs](https://www.prisma.io/docs)
- [Vitest docs](https://vitest.dev)
- CI runs `npm ci` → `npm run lint` → `npm test` → `npm run build` here
  (`.github/workflows/ci.yml`).
