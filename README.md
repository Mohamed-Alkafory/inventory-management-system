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

> **Project status:** Under development. The repository currently contains the initial application setup and development infrastructure. Core inventory and order management features have not been implemented yet.

## Overview

The project is organized as two independent applications backed by a shared PostgreSQL database.

- **Frontend:** A React application that provides the user interface.
- **Backend:** A NestJS REST API that will handle application logic and data access.
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

The architecture represents the intended application design. Frontend-to-backend integration and the core business features are still under development.

## Current Status

| Component                    | Current state                                                  |
| ---------------------------- | -------------------------------------------------------------- |
| Frontend                     | Initial React and Vite application                             |
| Backend                      | Initial NestJS REST API                                        |
| Database                     | PostgreSQL container configured                                |
| Prisma                       | Initial configuration; no application models or migrations yet |
| Automated checks             | GitHub Actions CI for backend and frontend                     |
| Inventory and order features | Not implemented yet                                            |

The backend currently exposes `GET /`, which returns `"Hello World!"`. The frontend is still an initial application shell, and API calls have not yet been integrated.

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

The backend waits for PostgreSQL to become healthy and applies pending Prisma migrations before starting.

If port `3000` is already in use on your machine, publish the API on another host port by setting `BACKEND_PORT` for that command, e.g. `BACKEND_PORT=3001 docker compose up --build -d`.

- API base URL: `http://localhost:3000/api/v1`
- Health endpoint: `http://localhost:3000/api/v1/health`
- Swagger UI: `http://localhost:3000/api/docs`

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

Start the backend from `backend/`:

```bash
npm run start:dev
```

Start the frontend from `frontend/` in a separate terminal:

```bash
npm run dev
```

### 7. Open the applications

| Service     | URL                   |
| ----------- | --------------------- |
| Frontend    | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| PostgreSQL  | localhost:5432        |

The frontend currently displays the initial application shell. The backend's root endpoint responds to `GET /` with `"Hello World!"`.

## Environment Variables

| Variable            | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `POSTGRES_USER`     | PostgreSQL username                          |
| `POSTGRES_PASSWORD` | PostgreSQL password                          |
| `POSTGRES_DB`       | Database name                                |
| `POSTGRES_PORT`     | Host port mapped to PostgreSQL               |
| `DATABASE_URL`      | Database connection string used by Prisma    |
| `PORT`              | Backend API port; defaults to `3000`         |
| `JWT_SECRET`        | Reserved for future authentication           |
| `VITE_API_URL`      | Reserved for future frontend API integration |

The JWT and frontend API variables are reserved for planned functionality; the current application does not yet consume them.

Environment templates contain placeholders only. Keep actual secrets in ignored local `.env` files and never commit them.

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
- Prisma schema and configuration files.
- PostgreSQL adapter dependencies.

Application models and migrations have not been created yet.

Once the team agrees on the initial data model, create migrations from `backend/`:

```bash
npx prisma migrate dev
npx prisma generate
```

Run these commands only after application models have been added to `backend/prisma/schema.prisma`.

Database design should be reviewed before migrations are introduced so the team can agree on entities, relationships, constraints, and data integrity requirements.

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
npm run lint
npm test
npm run test:e2e
npm run build
```

Frontend:

```bash
npm run lint
npm run build
```

Run each command from its corresponding application directory.

## Troubleshooting

### PostgreSQL connection errors

If Prisma reports `P1001` or the connection is refused:

1. Check that Docker is running.
2. Run `docker compose ps` from the repository root.
3. Verify the credentials and port in the root `.env`.
4. Ensure `DATABASE_URL` in `backend/.env` matches those values.
5. Check the database logs with `docker compose logs db`.

### Port already in use

If a port is occupied, stop the conflicting process or configure an alternative port. If you change the PostgreSQL host port, update `DATABASE_URL` accordingly.

Vite may automatically select another port if `5173` is unavailable.

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
