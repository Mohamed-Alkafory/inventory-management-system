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
`PORT` (API port, defaults to `3000`), `JWT_SECRET` (reserved for upcoming
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

Health check: `GET http://localhost:3000/` → `"Hello World!"`.

## Prisma

- Schema: `prisma/schema.prisma` (shell — **no models yet**).
- Connection: `prisma.config.ts` reads `DATABASE_URL` from `backend/.env`.
- Validate: `npx prisma validate` (from `backend/`).
- After the team adds models: `npx prisma migrate dev`, then
  `npx prisma generate` (client output: `src/generated/prisma/`, git-ignored).

## Reference

- [NestJS docs](https://docs.nestjs.com)
- [Prisma docs](https://www.prisma.io/docs)
- [Vitest docs](https://vitest.dev)
- CI runs `npm ci` → `npm run lint` → `npm test` → `npm run build` here
  (`.github/workflows/ci.yml`).
