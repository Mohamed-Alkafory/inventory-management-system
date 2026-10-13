# Inventory Management System

A starter for an inventory & order management app: a React frontend talking to
a NestJS REST API, backed by PostgreSQL. Docker Compose runs the database
locally; the apps themselves run on your machine with npm.

## How it works

- **`frontend/`** — React 19 + TypeScript + Vite (+ Tailwind CSS, React Router,
  React Query, Axios). Runs in the browser and calls the backend API.
  Currently a starter shell; no API calls are wired yet.
- **`backend/`** — NestJS 12 + TypeScript REST API (+ Prisma 7, Vitest).
  Listens on port `3000` by default and currently exposes `GET /`, which
  answers `"Hello World!"`.
- **PostgreSQL 16** (via `docker-compose.yml`, service `db`) — stores the data.
  The backend reaches it through `DATABASE_URL` using Prisma.
- **Prisma** — schema in `backend/prisma/schema.prisma`, connection configured
  in `backend/prisma.config.ts`. No application models or migrations exist yet
  (see [Database](#database)).

Typical request flow (once features are built):
browser → Vite dev server → NestJS API (`http://localhost:3000`) → Prisma →
PostgreSQL (`localhost:5432`).

## Prerequisites

| Tool | Version | Install | Verify |
|---|---|---|---|
| Git | any recent | <https://git-scm.com/downloads> | `git --version` |
| Node.js (includes npm) | **22** (matches CI) | <https://nodejs.org/en/download> | `node --version` → `v22.x`, `npm --version` |
| Docker + Docker Compose | any recent Docker Desktop | <https://docs.docker.com/get-docker/> | `docker --version`, `docker compose version` |

> Node 24 also works locally, but CI builds with Node 22, so Node 22 is the
> reference version. Use one Node version per terminal session.

## Installation and setup

Run the `docker` / `cp` steps from the **repository root**. The `npm ci`
steps run **inside** `backend/` and `frontend/` (each has its own
`package.json` + `package-lock.json`).

### 1. Clone the repository

```bash
git clone https://github.com/Mohamed-Alkafory/inventory-management-system.git
```

### 2. Enter the project directory

```bash
cd inventory-management-system
```

### 3. Create the environment files

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

The frontend does not need an `.env` yet (see
[Environment variables](#environment-variables)).

### 4. Start PostgreSQL

```bash
docker compose up -d
```

This starts only the database (`postgres:16-alpine`, data kept in the
`pgdata` volume). Check it is healthy:

```bash
docker compose ps
```

### 5. Install backend dependencies

```bash
cd backend && npm ci && cd ..
```

This uses `backend/package-lock.json`, so everyone gets identical versions.

### 6. Validate the Prisma setup

```bash
cd backend && npx prisma validate && cd ..
```

Expected output: `The schema at prisma/schema.prisma is valid`.
See [Database](#database) for what exists (schema shell only) and what comes
later (models, migrations).

### 7. Install frontend dependencies

```bash
cd frontend && npm ci && cd ..
```

### 8. Start the backend and frontend (two terminals)

Terminal 1 — backend (from `backend/`):

```bash
cd backend
npm run start:dev
```

Terminal 2 — frontend (from `frontend/`):

```bash
cd frontend
npm run dev
```

### 9. Open the application

- Frontend: <http://localhost:5173> (Vite default; `vite.config.ts` sets no
  custom port)
- Backend API: <http://localhost:3000> — `GET /` returns `"Hello World!"`

## Environment variables

| Variable | Used by | Purpose | Example (safe default) |
|---|---|---|---|
| `POSTGRES_USER` | `docker-compose.yml` | DB superuser for the container | `inventory` |
| `POSTGRES_PASSWORD` | `docker-compose.yml` | DB password for the container | `change_me` (dev only) |
| `POSTGRES_DB` | `docker-compose.yml` | Database created on first start | `inventory_db` |
| `POSTGRES_PORT` | `docker-compose.yml` | Host port mapped to container `5432` | `5432` |
| `DATABASE_URL` | Prisma (`backend/prisma.config.ts`) | Connection string; **must match the `POSTGRES_*` values above** | `postgresql://inventory:change_me@localhost:5432/inventory_db?schema=public` |
| `PORT` | Backend (`backend/src/main.ts`) | API listen port (defaults to `3000` if unset) | `3000` |
| `JWT_SECRET` | Backend (reserved) | Signing key for upcoming auth; **no code reads it yet** | `change_me` (dev only) |
| `VITE_API_URL` | Frontend (reserved) | Base URL the frontend will use for the API; **no code reads it yet** | `http://localhost:3000` |

Rules:

- Templates (`.env.example`) are committed and contain placeholders only.
  Real `.env` files are git-ignored — **never commit them** (see
  `CONTRIBUTING.md`).
- `DATABASE_URL` exists in both the root `.env.example` (reference) and
  `backend/.env.example` (the one the backend actually loads). If you change
  any `POSTGRES_*` value, update `DATABASE_URL` in **both** `.env` files to
  match.
- The frontend needs `frontend/.env` only once frontend code reads
  `VITE_API_URL`: `cp frontend/.env.example frontend/.env`.

## Running and testing

### Start / stop / restart

```bash
# Database (from repo root)
docker compose up -d      # start (keeps data in the pgdata volume)
docker compose stop       # stop (keeps data)
docker compose restart db # restart
docker compose logs db    # follow database logs
docker compose down       # stop AND remove containers (data in pgdata survives)

# Backend (from backend/)
npm run start:dev   # watch mode (daily development)
npm run start:debug # watch mode with debugger
npm run start       # single run
npm run build       # production build -> dist/
npm run start:prod  # run the built output (needs npm run build first)

# Frontend (from frontend/)
npm run dev     # dev server with hot reload
npm run preview # serve the production build (needs npm run build first)
```

> Never delete the `pgdata` volume or reset the database to "fix" a problem —
> that destroys local data. Ask the team first.

### Lint, build, test (same commands CI runs)

```bash
# Backend (from backend/)
npm run lint    # oxlint over src/ and test/
npm test        # unit tests (Vitest, **/*.spec.ts)
npm run test:e2e # e2e tests (Vitest, **/*.e2e-spec.ts)
npm run test:cov # unit tests with coverage
npm run test:watch # unit tests in watch mode
npm run format  # prettier over src/ and test/
npm run build   # NestJS production build

# Frontend (from frontend/)
npm run lint    # eslint
npm run build   # tsc -b && vite build
```

CI (`.github/workflows/ci.yml`) runs `npm ci` → `lint` → `test`/`build` in
each folder on every PR and every push to `main`.

### Database

Current state: `backend/prisma/schema.prisma` is a shell (generator +
`provider = "postgresql"`, **no models**), there is no
`backend/prisma/migrations/` directory, and the connection URL lives in
`backend/prisma.config.ts` (read from `DATABASE_URL`). Verified check:

```bash
# From backend/
npx prisma validate
```

When the team adds the first models, the flow will be:

```bash
# From backend/ (only after models exist in schema.prisma)
npx prisma migrate dev   # creates prisma/migrations/ and applies them
npx prisma generate      # (re)generates the client into src/generated/prisma
```

Do **not** run `migrate` commands until models are designed together.

### Verify everything works

1. `docker compose ps` shows `db` healthy.
2. `GET http://localhost:3000/` returns `"Hello World!"`.
3. `http://localhost:5173` renders the starter page.
4. `npm test` (backend) and `npm run lint` (both folders) pass.

## Troubleshooting

- **Port already in use (`EADDRINUSE`, or Vite picks 5174+).**
  Another process owns the port. Either stop it, or override the port:
  backend → set `PORT=3001` in `backend/.env`; database → set
  `POSTGRES_PORT=5433` in root `.env` **and** update the port in
  `DATABASE_URL` in both `.env` files; frontend → `npm run dev -- --port 5174`.
- **Database connection failures (`ECONNREFUSED`, Prisma `P1001`).**
  Checklist: `docker compose ps` (is `db` up/healthy?), is Docker Desktop
  running?, does `DATABASE_URL` in `backend/.env` match the root `.env`
  (`POSTGRES_USER`/`PASSWORD`/`DB`/port)? After changing the root `.env`,
  recreate the container: `docker compose up -d`.
- **`docker compose` fails / Docker not running.**
  Start Docker Desktop and wait until it reports running, then retry.
  Verify with `docker compose version`.
- **Missing/incorrect env vars.**
  Re-copy the templates (`cp .env.example .env`,
  `cp backend/.env.example backend/.env`), then edit values. Remember
  `backend/.env` is the file the backend loads — editing only the root
  `.env` does not change backend behavior except through Compose.
- **Prisma errors (`P1000` auth failed, schema not found, client not generated).**
  `P1000` (wrong password) almost always means `DATABASE_URL` disagrees with
  the container credentials — compare both `.env` files. Run Prisma commands
  from `backend/` so `prisma.config.ts` and `backend/.env` resolve correctly.
  There are no migrations yet, so `migrate` failures mean models haven't been
  added — see [Database](#database).
- **`npm ci` fails with `EUSAGE` / "Missing … from lock file".**
  You are likely on an npm version whose lock validation disagrees with the
  lockfile (seen before with npm 10 vs 11 on an optional peer). First retry
  with the reference toolchain (Node 22). If a manifest really changed,
  regenerate from that folder only: `cd backend && npm install` (or
  `frontend/`), then verify with `npm ci`. Never hand-edit lockfiles, and
  never run `npm install` at the repo root (there is no root package).
- **`npm ci` fails with `EPERM` on Windows (locked `.node` file).**
  A stray Node process (dev server, watcher, antivirus) holds a native binary
  in `node_modules`. Stop local Node processes / close editors holding the
  folder and retry. Do not delete volumes or databases for this.
- **`tsc` / eslint errors in frontend after switching branches.**
  Reinstall from `frontend/`: `npm ci`. The frontend has fixed TypeScript
  configs (`tsconfig.app.json`, `tsconfig.node.json`) — don't bypass type
  errors, fix the code or ask the team.

## Team workflow

- Branching, commits (Conventional Commits), and PR rules live in
  [`CONTRIBUTING.md`](CONTRIBUTING.md) — trunk-based short branches,
  rebase, squash-merge, at least one review, never push to `main` directly.
- Backend and frontend are **separate npm packages**: each has its own
  `package.json` + `package-lock.json`. After pulling, install in any folder
  whose manifest changed:
  ```bash
  git pull --ff-only origin main
  cd backend && npm ci && cd ..
  cd frontend && npm ci && cd ..
  ```
  Always prefer `npm ci` (uses the lockfile). Use `npm install` only when you
  intentionally add/change a dependency, and commit the updated lockfile.
- Docs live in [`docs/`](docs/) (API contract, DB schema, decisions) and are
  currently placeholders — fill them as the design lands.
- Folder guides: [`backend/README.md`](backend/README.md),
  [`frontend/README.md`](frontend/README.md).
