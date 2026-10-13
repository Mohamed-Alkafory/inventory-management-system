# Inventory Management System

Inventory & Order Management — React + NestJS + PostgreSQL + Docker.

## Prerequisites

- Node.js 22, npm, Docker + Docker Compose.

## Setup (fresh clone)

```bash
# 1. Environment files (placeholders only — never commit real .env files)
cp .env.example .env
cp backend/.env.example backend/.env
# Optional for the frontend (only needed once it calls the API):
# cp frontend/.env.example frontend/.env

# 2. Start PostgreSQL (Docker only runs the database; apps run locally via npm)
docker compose up -d

# 3. Install dependencies
cd backend && npm ci && cd ..
cd frontend && npm ci && cd ..

# 4. Validate the Prisma setup (no database models or migrations exist yet)
cd backend && npx prisma validate && cd ..
```

`DATABASE_URL` (backend) must stay in sync with the `POSTGRES_*` values in the
root `.env`. Defaults target `localhost:5432`, matching `docker-compose.yml`.

## Available checks

```bash
# Backend (from backend/)
npm run lint        # oxlint
npm test            # unit tests (Vitest)
npm run test:e2e    # e2e tests (Vitest)
npm run build       # NestJS production build

# Frontend (from frontend/)
npm run lint        # eslint
npm run build       # tsc + vite build
```

> Note: application database models and migrations are **not implemented yet**
> — the team designs them together before any `prisma migrate` is run.
> There is one known starter-code issue: `backend/src/main.ts` uses a
> top-level `await` that fails the production build (`TS1309`, CommonJS).
> The fix is a one-line change to `bootstrap();` in that file, left for the
> team since application source files are not touched by setup changes.

## Structure

- `backend/`  NestJS + Prisma + Vitest
- `frontend/` React + TypeScript + Vite
- `docs/`     API contract, DB schema, decisions

See `CONTRIBUTING.md` for the Git workflow.
