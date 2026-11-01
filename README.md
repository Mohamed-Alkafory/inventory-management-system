<div align="center">

# _Inventory Management System_

**A centralized platform for managing inventory, tracking orders, and organizing suppliers.**

[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-Bundler-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
<br/>
[![NestJS](https://img.shields.io/badge/NestJS-Backend-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![React Query](https://img.shields.io/badge/React_Query-TanStack-FF4154?style=for-the-badge&logo=reactquery&logoColor=white)](https://tanstack.com/query/latest)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/docs)
<br/>
[![React Router](https://img.shields.io/badge/React_Router-v7-CA4245?style=for-the-badge&logo=reactrouter&logoColor=white)](https://reactrouter.com/)
[![React Hook Form](https://img.shields.io/badge/React_Hook_Form-Forms-EC5990?style=for-the-badge&logo=reacthookform&logoColor=white)](https://react-hook-form.com/)
[![Zod](https://img.shields.io/badge/Zod-Validation-3068b7?style=for-the-badge&logo=zod&logoColor=white)](https://zod.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docs.docker.com/compose/)
<br/>
[![Vitest](https://img.shields.io/badge/Vitest-Tests-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

</div>

An inventory and order management system designed to bring product tracking, supplier management, and order operations into one place.

> **Project status:** Core inventory and order management backend features are implemented and tested.

## Overview

The project is organized as two independent applications backed by a shared PostgreSQL database.

- **Frontend:** A React application that provides the catalog, customer shopping, and staff/admin/support interfaces (Implemented).
- **Backend:** A NestJS REST API that handles application logic and data access (Implemented).
- **Database:** PostgreSQL for persistent data storage.
- **ORM:** Prisma for database schema management and queries.
- **Development environment:** Docker Compose for running PostgreSQL locally.

### Architecture

```text
Browser
   |
   v
React Frontend
   |
   | HTTP / REST API
   v
NestJS Backend
   |
   v
Prisma
   |
   v
PostgreSQL
```

## Current Status

| Component                    | Current state                                                  |
| ---------------------------- | -------------------------------------------------------------- |
| Frontend                     | React + Vite app with catalog, customer, staff, admin and support screens |
| Backend                      | NestJS REST API with core business logic                       |
| Database                     | PostgreSQL container configured; Neon-ready migrations         |
| Prisma                       | Models, migrations, and seed data implemented                  |
| Automated checks             | GitHub Actions CI with backend unit/E2E and frontend tests     |
| Inventory and order features | Implemented across backend and frontend                        |

The backend exposes REST endpoints under `/api/v1` (liveness at `GET /api/v1/health/live`, readiness at `GET /api/v1/health` returning `{"status":"ok","db":"up"}`). The frontend is implemented; see [Deployment (free tier)](#deployment-free-tier) for hosting it.

## Tech Stack

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack Query
- React Hook Form
- Zod
- Axios

### Backend

- NestJS 12
- TypeScript
- Prisma 7
- PostgreSQL
- Vitest

### Development and Quality

- Docker Compose
- npm
- ESLint
- oxlint
- Prettier
- GitHub Actions

## Running with Docker Compose

### Prerequisites

- Docker Desktop or Docker Engine with Docker Compose.
- Configured local environment files based on the provided examples.

### Setup

Create the root `.env` from `.env.example` and `backend/.env` from `backend/.env.example`. Configure the database credentials and required application secrets. Never commit real secrets.

### Start the application

From the repository root:

```bash
docker compose up --build -d
```

The backend waits for PostgreSQL to become healthy and applies pending Prisma migrations before starting. The frontend waits for the backend health check, then serves the built React app through Nginx.

The frontend is published on host port `8080` by default (`FRONTEND_PORT`) and the API on host port `3010` (`BACKEND_PORT`). Nginx proxies `/api/` and `/uploads/` to the backend, so the app calls the API same-origin and CORS is not involved.

- Web app: `http://localhost:8080`
- API base URL: `http://localhost:3010/api/v1`
- Health endpoint: `http://localhost:3010/api/v1/health` (readiness) and `http://localhost:3010/api/v1/health/live` (liveness)
- Swagger UI: `http://localhost:3010/api/docs`

To point the built frontend at an external API instead of the Nginx proxy, set `VITE_API_URL` (including the `/api/v1` prefix) before building:

```bash
VITE_API_URL=https://api.example.com/api/v1 docker compose up --build -d
```

### Stop the application

```bash
docker compose down
```

The PostgreSQL data volume is preserved when using `docker compose down`.

**Warning:** `docker compose down -v` removes the PostgreSQL volume and deletes the persisted database data.

## Getting Started

Follow these steps to run the project locally.

### Prerequisites

| Tool           | Version                | Verification             |
| -------------- | ---------------------- | ------------------------ |
| Git            | Recent version         | `git --version`          |
| Node.js        | 22 (reference version) | `node --version`         |
| npm            | Included with Node.js  | `npm --version`          |
| Docker         | Recent version         | `docker --version`       |
| Docker Compose | Compose v2             | `docker compose version` |

Node.js 22 is the reference version used by CI. Other versions may work locally, but use Node.js 22 when troubleshooting environment-specific issues.

### 1. Clone the repository

```bash
git clone https://github.com/Mohamed-Alkafory/inventory-management-system.git
cd inventory-management-system
```

### 2. Configure environment variables

Create the local environment files from their templates:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

Update the placeholder credentials if necessary. Ensure that `DATABASE_URL` in `backend/.env` matches the PostgreSQL credentials and port configured in the root `.env`.

Do not commit real environment files or credentials.

### 3. Start PostgreSQL

From the repository root:

```bash
docker compose up -d
docker compose ps
```

Wait until the database service reports a healthy status.

The Compose configuration uses PostgreSQL 16 and persists database data in the `pgdata` volume.

### 4. Install backend dependencies

```bash
cd backend
npm ci
```

Validate the Prisma configuration:

```bash
npx prisma validate
```

### 5. Install frontend dependencies

Open another terminal, return to the repository root, and run:

```bash
cd frontend
npm ci
```

Each application has its own `package.json` and lockfile. Install dependencies separately in each directory.

### 6. Start the applications

From the repository root:

```bash
npm run dev
```

This starts the backend in watch mode on port `3010` and the frontend on port `5173`. The command refuses to start if either port is occupied, reports the conflicting PID, and stops both servers when you press `Ctrl+C`.

If you prefer separate terminals, run `npm run start:dev` from `backend/` and `npm run dev` from `frontend/`.

The frontend calls the API through Vite's `/api` proxy, so no backend URL needs to be configured for local development.

### 7. Open the applications

| Service     | URL                   |
| ----------- | --------------------- |
| Frontend    | http://localhost:5173 |
| Backend API | http://localhost:3010 |
| PostgreSQL  | localhost:5432        |

The backend exposes `GET /api/v1/health/live` (liveness, no database access) and `GET /api/v1/health` (readiness) for health checks. Through the Vite proxy, the same endpoints are available at `http://localhost:5173/api/v1/health/live` and `http://localhost:5173/api/v1/health`.

## Environment Variables

Environment templates contain placeholders only: `.env.example` (repo root, used by Docker Compose), `backend/.env.example`, and `frontend/.env.example`. Keep actual secrets in ignored local `.env` files and never commit them.

### Local development

| Variable | Where | Required | Value shape / example placeholder |
| --- | --- | --- | --- |
| `POSTGRES_USER` | root `.env` | yes (Compose) | Postgres user, e.g. `inventory` |
| `POSTGRES_PASSWORD` | root `.env` | yes (Compose) | Postgres password, e.g. `<your-value>` |
| `POSTGRES_DB` | root `.env` | yes (Compose) | Database name, e.g. `inventory_db` |
| `POSTGRES_PORT` | root `.env` | no | Host port, default `5432` |
| `BACKEND_PORT` | root `.env` | no | Published API port, default `3010` |
| `FRONTEND_PORT` | root `.env` | no | Published web port, default `8080` |
| `DATABASE_URL` | root + `backend/.env` | yes | `postgresql://inventory:<password>@localhost:5432/inventory_db?schema=public` |
| `DIRECT_URL` | `backend/.env` | no | Direct (non-pooled) URL; only used by the Prisma CLI |
| `PORT` | `backend/.env` | no | API port, default `3000`; local scripts use `3010` |
| `CORS_ORIGIN` | `backend/.env` | yes | `http://localhost:5173` |
| `JWT_SECRET` | `backend/.env` | yes | Random string; production requires ≥32 chars and rejects placeholders |
| `JWT_EXPIRES_IN` | `backend/.env` | no | Access-token lifetime, default `15m` |
| `SWAGGER_ENABLED` | `backend/.env` | no | `true` to serve Swagger in production; on by default outside production |
| `TRUST_PROXY` | `backend/.env` | no | Trusted proxy hops; `0` locally, `1` behind one proxy |
| `PG_POOL_MAX` | `backend/.env` | no | Pool size, default `5` |
| `PG_CONNECTION_TIMEOUT_MS` | `backend/.env` | no | Default `10000` |
| `PG_IDLE_TIMEOUT_MS` | `backend/.env` | no | Default `10000` |
| `UPLOADS_DIR` | `backend/.env` | no | Local upload directory, default `uploads` |
| `IMAGE_STORAGE` | `backend/.env` | no | `local` (default) or `cloudinary` |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | `backend/.env` | only for Cloudinary | Credentials from the Cloudinary dashboard |
| `VITE_API_URL` | `frontend/.env` | no | Absolute API URL ending in `/api/v1`; leave unset to use the Vite proxy |
| `VITE_USE_MOCK` | `frontend/.env` | no | `true` only to run without a backend; production must leave it unset/`false` |

### CI

`.github/workflows/ci.yml` starts a PostgreSQL 16 service and provides these values to the E2E step. They are throwaway test values, not production secrets.

| Variable | Value in CI |
| --- | --- |
| `DATABASE_URL` | `postgresql://inventory:change_me@localhost:5432/inventory_test?schema=public` |
| `JWT_SECRET` | `ci_secret_value` (production rules are not enforced because `NODE_ENV` is not `production`) |
| `JWT_EXPIRES_IN` | `15m` |
| `CORS_ORIGIN` | `http://localhost:5173` |

`npx prisma validate` runs before lint/tests, and the frontend job runs `npm test -- --run` before its build.

## Deployment (free tier)

This is a reference deployment: Vercel (frontend), Render (backend Docker service), Neon (PostgreSQL), Cloudinary (images), and an external uptime pinger.

### Architecture

```text
                 Browser
                    |
        +-----------+-----------+
        |                       |
        v                       v
 Vercel (static React)     Uptime pinger
        |                       |
        | HTTPS  /api/v1        | GET /api/v1/health/live
        v                       v
 Render web service (Docker: backend/Dockerfile)
        |
        +--> Neon PostgreSQL (pooled DATABASE_URL; direct DIRECT_URL for migrations)
        |
        +--> Cloudinary (product images, avatars)
```

- Vercel serves the SPA and calls the Render API directly, so `CORS_ORIGIN` on Render must include the Vercel origin.
- The Render container runs `prisma migrate deploy` on every start, then `node dist/main.js`.
- Render's free web service sleeps after inactivity; Neon's free compute also suspends. The pinger keeps Render awake without waking Neon.

### Order of operations

Do the steps in this order; later steps need values produced by earlier ones.

1. Create the Neon database and copy both connection strings.
2. Create the Cloudinary account and copy the three credentials.
3. Deploy the backend on Render with a provisional `CORS_ORIGIN`.
4. Deploy the frontend on Vercel and copy the production origin.
5. Update `CORS_ORIGIN` on Render with the exact Vercel origin and redeploy.
6. Register the first account, promote it to admin with SQL.
7. Configure the keep-alive pinger.
8. Run the verification checklist.

### 1. Neon (PostgreSQL)

1. Create a Neon project and database. Choose a region close to the Render region you will use.
2. From **Connection Details**, copy the **pooled** connection string (host contains `-pooler`) and use it as `DATABASE_URL`. It must include `sslmode=require` (or `sslmode=verify-full`).
3. Copy the **direct** connection string (no `-pooler`) and use it as `DIRECT_URL`. Prisma CLI commands (`migrate`, `seed`) use `DIRECT_URL` when set, and migrations work best over the direct connection.
4. Keep the credentials out of source control. Neon's free plan has storage and compute-hour limits that change over time; check the current plan before relying on them.

### 2. Cloudinary (images)

1. Create a free Cloudinary account and note the **Cloud name**, **API key**, and **API secret** from the dashboard.
2. Set `IMAGE_STORAGE=cloudinary` plus `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` on Render.
3. Without `IMAGE_STORAGE=cloudinary` the API writes to local disk (`UPLOADS_DIR`), which is ephemeral on Render and lost on redeploy — use Cloudinary in production.

### 3. Render (backend)

1. Create a **Web Service** from this repository.
2. Runtime: **Docker**. Dockerfile path: `backend/Dockerfile`. Docker build context: `backend`.
3. Region: the same region as the Neon project.
4. Health check path: `/api/v1/health/live` (liveness only, never touches the database).
5. Add the environment variables from the table below. Render injects `PORT`; do not set it manually.
6. Deploy. The container applies pending migrations on start. Render's free instance may take a while to build and boot.
7. Note the service URL, e.g. `https://<your-service>.onrender.com`.

`CORS_ORIGIN` is required at boot. Before Vercel exists, use a provisional but valid origin such as `http://localhost:5173`; replace it with the exact Vercel origin in step 5.

#### Backend environment variables (Render)

| Variable | Required | Value shape / example placeholder |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon pooled URL: `postgresql://<user>:<password>@<host>-pooler.<region>.aws.neon.tech/<db>?sslmode=require` |
| `DIRECT_URL` | recommended | Neon direct URL (no `-pooler`), same credentials and `sslmode` |
| `JWT_SECRET` | yes | Random, ≥32 chars, not a placeholder (e.g. `openssl rand -base64 48`) |
| `CORS_ORIGIN` | yes | Comma-separated origins, no trailing slash, e.g. `https://<project>.vercel.app` |
| `JWT_EXPIRES_IN` | no | `15m` |
| `SWAGGER_ENABLED` | no | `false` in production |
| `TRUST_PROXY` | recommended | `1` (Render is a single proxy hop, so rate limits are per client) |
| `PG_POOL_MAX` | no | `5` |
| `PG_CONNECTION_TIMEOUT_MS` | no | `10000` |
| `PG_IDLE_TIMEOUT_MS` | no | `10000` |
| `UPLOADS_DIR` | no | `uploads` (irrelevant when Cloudinary is used) |
| `IMAGE_STORAGE` | yes in production | `cloudinary` |
| `CLOUDINARY_CLOUD_NAME` | with Cloudinary | `<your-cloud-name>` |
| `CLOUDINARY_API_KEY` | with Cloudinary | `<your-api-key>` |
| `CLOUDINARY_API_SECRET` | with Cloudinary | `<your-api-secret>` |

`NODE_ENV=production` is already set by the Dockerfile.

### 4. Vercel (frontend)

1. Import the repository in Vercel.
2. **Root Directory:** `frontend`.
3. Framework preset: **Vite**. Build command `npm run build`, output directory `dist`.
4. Add `VITE_API_URL` for Production and Preview: the Render service URL plus `/api/v1`, e.g. `https://<your-service>.onrender.com/api/v1`. Do not add a trailing slash after `/api/v1`.
5. Leave `VITE_USE_MOCK` unset (or `false`).
6. Deploy and copy the production origin, e.g. `https://<project>.vercel.app`.

`VITE_API_URL` is embedded at build time, so change it only by redeploying the frontend. `frontend/vercel.json` rewrites every path to `/index.html` for client-side routing.

#### Frontend environment variables (Vercel)

| Variable | Required | Value shape / example placeholder |
| --- | --- | --- |
| `VITE_API_URL` | yes | Absolute URL ending in `/api/v1`, e.g. `https://<your-service>.onrender.com/api/v1` |
| `VITE_USE_MOCK` | no | Unset or `false` in production |

### 5. Update `CORS_ORIGIN` on Render

In the Render dashboard, set:

```text
CORS_ORIGIN=https://<project>.vercel.app
```

Rules enforced by the backend:

- no trailing slash (the value is normalised, but keep it clean);
- comma-separated for several origins, e.g. `https://app.vercel.app,https://staging.vercel.app`;
- `*` is rejected, and so are URLs with a path, query, fragment, or credentials.

Save the change and let Render redeploy. Until this is done, the Vercel app's API calls fail with CORS errors.

### 6. First admin

> [!WARNING]
> Never run `npm run db:seed` / `prisma db seed` in production. It inserts well-known development accounts and sample data.

Registration always creates a `CUSTOMER`, regardless of the schema default. To create the first admin:

1. Open the deployed app and register a normal account (e.g. `owner@example.com`).
2. In the Neon **SQL Editor**, run the statement below with that account's email:

```sql
UPDATE users
SET role = 'ADMIN'
WHERE email = '<your-admin-email>';
```

`users` is the table, `role` is the column, and `"UserRole"` is the Postgres enum type (`ADMIN`, `STAFF`, `CUSTOMER`, `SUPPORT`). The literal `'ADMIN'` is cast to the enum automatically.

3. Sign out and back in (or just reload) — no restart is needed. `JwtAuthGuard` reloads the user's role from the database on every authenticated request, so the new role takes effect immediately after the next request. Existing access tokens do not need to be reissued for the role change, though the frontend may cache the old role in its own state until it refreshes `/auth/me`.

### 7. Keep-alive

Create a free monitor in UptimeRobot or cron-job.org:

- URL: `https://<your-service>.onrender.com/api/v1/health/live`
- Method: `GET`
- Interval: every 10 minutes
- Expected response: HTTP `200` with `{"status":"ok"}`

**Why `/health/live` and not `/health`:** `/health` runs `SELECT 1`, which wakes a suspended Neon compute and consumes free compute hours. `/health/live` answers from the process without touching the database, so it keeps the Render service warm without waking Postgres. It is also the Render health check path.

**Cold starts:** Render may sleep after inactivity. The first visitor can wait while the container boots, and the first database query may also wait for Neon to resume. The frontend shows a cold-start banner after 3 seconds and retries the failed GET/HEAD request up to two times (after 1 second, then 3 seconds). Expect a slow first load, not an error, if you wait for the retries.

### 8. Verification checklist

Replace `<api>` with your full Render base including scheme and `/api/v1` (e.g. `https://<your-service>.onrender.com/api/v1`) and `<web>` with your Vercel origin (e.g. `https://<project>.vercel.app`).

```bash
# 1. Liveness: 200 {"status":"ok"} and no database access
curl -i "<api>/health/live"

# 2. Readiness: 200 {"status":"ok","db":"up"} (may take a few seconds if Neon is suspended)
curl -i "<api>/health"

# 3. Public catalog: 200 and a paginated product list
curl -i "<api>/catalog/products?limit=5"

# 4. CORS preflight for the Vercel origin: expect 204 and Access-Control-Allow-Origin
curl -i -X OPTIONS "<api>/auth/me" \
  -H "Origin: <web>" \
  -H "Access-Control-Request-Method: GET"

# 5. Protected route without a token: expect 401
curl -i "<api>/auth/me"

# 6. Swagger disabled in production: expect 404
curl -o /dev/null -s -w "%{http_code}\n" "https://<your-service>.onrender.com/api/docs"
```

Swagger is mounted on the API host under `/api/docs` (outside the `/api/v1` prefix); it is disabled when `NODE_ENV=production` unless `SWAGGER_ENABLED=true`.

Manual smoke test:

- **Anonymous:** browse the catalog, filter/search, open a product, submit the contact form.
- **CUSTOMER:** register/sign in, add items to the cart, place an order, see it under own orders, update the profile/avatar, read notifications.
- **STAFF:** sign in and manage orders, adjust stock, read suppliers and purchase orders, receive a purchase order.
- **ADMIN:** everything above plus products/categories/suppliers writes and image uploads, user management, dashboard, reports, audit log.
- **SUPPORT:** read products/categories, view all orders, manage the contact inbox; write actions are rejected.

### Deployment troubleshooting

**CORS errors in the browser**

- Confirm `CORS_ORIGIN` matches the exact Vercel origin (scheme + host, no trailing slash) and redeploy Render after changing it.
- Multiple origins must be comma-separated.
- `*` is rejected by the backend at boot; list origins explicitly.
- Browser extensions or a custom domain can change the `Origin` header — check the failing request's `Origin` value.

**502 / 503 after the service sleeps**

- Render cold start: wait for the container to boot, then retry.
- Neon cold start: the first query can take a few seconds; retry.
- If it persists, check the Render logs for a crash loop or a migration failure.

**"Can't reach the server" in the frontend**

- Check `VITE_API_URL` on Vercel: it must be the full URL ending in `/api/v1` and must have been set before the build.
- Confirm the Render URL responds to `/health/live`.
- Redeploy the frontend after changing `VITE_API_URL` (it is baked into the bundle).

**Migration failures on start**

- Use the Neon **direct** URL for `DIRECT_URL`; the pooled URL can fail for schema changes.
- Both URLs need `sslmode=require` (or `sslmode=verify-full`).
- If the container exits during `prisma migrate deploy`, read the Render deploy logs; a failed migration blocks the cache and repeats on every start until resolved.

**Images not showing**

- `IMAGE_STORAGE=cloudinary` and all three `CLOUDINARY_*` variables must be set on Render; otherwise images are written to ephemeral local disk and disappear on redeploy.
- Check the Cloudinary dashboard for upload errors and the provider's free-plan limits.

**`JWT_SECRET` validation failure at boot**

- In production the value must be at least 32 characters and must not contain `change_me`, `changeme`, `secret`, `password`, `example`, or `ci_secret`.
- Generate one with `openssl rand -base64 48`, set it on Render, and redeploy.

**Swagger is reachable in production**

- Swagger is off when `NODE_ENV=production` unless `SWAGGER_ENABLED=true`. Remove that variable or set it to `false`, then redeploy.

### Known limitations

- **Free-tier sleep:** Render sleeps after inactivity and Neon suspends compute; expect cold starts. The `/health/live` pinger keeps Render warm but deliberately does not keep Neon awake.
- **Restarts:** Render may restart the service at any time. With `IMAGE_STORAGE=local`, uploaded files are lost; use Cloudinary.
- **Quotas:** Neon storage/compute hours, Cloudinary transformations/storage, Vercel bandwidth and build minutes, and Render instance hours are subject to each provider's current free-plan limits. Re-check them before relying on this deployment.
- **Single instance:** the free setup runs one backend instance; there is no horizontal scaling or high availability.
- **Migrations on boot:** the container runs `prisma migrate deploy` at start, so a broken migration prevents the API from booting.

## Development Commands

### Backend

Run commands from `backend/`.

| Command               | Description                      |
| --------------------- | -------------------------------- |
| `npm run start:dev`   | Start in watch mode              |
| `npm run start:debug` | Start with debugging             |
| `npm run start`       | Start the application            |
| `npm run build`       | Build the production application |
| `npm run start:prod`  | Run the production build         |
| `npm run lint`        | Run oxlint                       |
| `npm run format`      | Format source and test files     |
| `npm test`            | Run unit tests                   |
| `npm run test:e2e`    | Run end-to-end tests             |
| `npm run test:cov`    | Run tests with coverage          |
| `npm run test:watch`  | Run tests in watch mode          |

### Frontend

Run commands from `frontend/`.

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start the development server         |
| `npm run build`   | Type-check and build the application |
| `npm run preview` | Preview the production build         |
| `npm run lint`    | Run ESLint                           |

## Database

The database schema is managed through Prisma.

Current database setup includes:

- PostgreSQL connection configuration.
- Prisma schema with core models (User, Product, Order, etc.).
- PostgreSQL adapter dependencies.
- Automated migrations and seed data.

To load development sample data (idempotent), run from `backend/`:

```bash
npm run db:seed
```

> [!WARNING]
> The seed creates development-only credentials (`admin@example.com / Admin123!`). These are for local development only — never use them in a shared or production environment.

## Testing and CI

The repository includes automated checks for the backend and frontend.

The GitHub Actions workflow runs validation tasks on pushes to `main` and pull requests, including dependency installation, linting, tests, and builds.

Run the relevant checks locally before opening a pull request.

Backend:

```bash
npx prisma validate
npm run lint
npm test
npm run test:e2e
npm run build
```

Frontend:

```bash
npm run lint
npm test -- --run
npm run build
```

Run each command from its corresponding application directory.

Backend E2E tests reset their database between tests. They use a dedicated test database whose name contains `test` (default: `inventory_test`); set `E2E_DATABASE_URL` to override it. The test helper refuses to truncate any database without `test` in its name.

## Troubleshooting

### PostgreSQL connection errors

If Prisma reports `P1001` or the connection is refused:

1. Check that Docker is running.
2. Run `docker compose ps` from the repository root.
3. Verify the credentials and port in the root `.env`.
4. Ensure `DATABASE_URL` in `backend/.env` matches those values.
5. Check the database logs with `docker compose logs db`.

### Port already in use

Local development uses fixed ports: backend `3010` and frontend `5173`. `npm run dev` checks both ports and reports the conflicting PID instead of starting a second instance. Stop that process and run the command again.

Vite is configured with `strictPort: true`, so it fails instead of silently moving to `5174` (which would not match the backend CORS origin). If you change the PostgreSQL host port, update `DATABASE_URL` accordingly.

### Dependency installation errors

Use the reference Node.js version and run `npm ci` from the affected application directory.

If dependencies were intentionally changed, update the appropriate lockfile and verify that a clean `npm ci` succeeds before opening a pull request. Never hand-edit lockfiles.

### Database data

The `pgdata` volume persists database data between container restarts. Do not delete the volume or reset the database as a troubleshooting shortcut; doing so may permanently remove local data.

## Contributing

Contributions are welcome.

Before contributing, read the [Contributing Guide](CONTRIBUTING.md) for branch naming, commit conventions, pull request requirements, and code review expectations.

Please also review:

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)

Use an issue to discuss or track a task, work on a separate branch, and open a pull request against `main`. Do not push directly to `main`.

## Documentation

- [Contributing Guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [Authors](AUTHORS)
- [Backend Guide](backend/README.md)
- [Frontend Guide](frontend/README.md)
- [Design Documentation](docs/)
- [GitHub Actions Workflow](.github/workflows/ci.yml)

Design documents are being developed alongside the application.

## License

This project is licensed under the [MIT License](LICENSE).
