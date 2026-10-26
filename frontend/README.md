# Frontend — React + Vite

React 19 + TypeScript + Vite (+ Tailwind CSS, React Router, React Query,
Axios, React Hook Form + Zod). Currently a starter shell — no API calls are
wired yet. Full local setup lives in the [root README](../README.md).

## Setup

```bash
# From frontend/:
npm ci
npm run dev
```

Open <http://localhost:5173> (Vite default; `vite.config.ts` sets no custom
port). Path alias `@` maps to `src/` (see `vite.config.ts` and
`tsconfig.app.json`).

## Scripts (all run from `frontend/`)

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check (`tsc -b`) + production build into `dist/` |
| `npm run preview` | Serve the production build (after `npm run build`) |
| `npm run lint` | ESLint over the project |

## Environment

`VITE_API_URL` is the Nest API base URL **including the global `/api/v1`
prefix** (e.g. `http://localhost:3000/api/v1`). Copy `frontend/.env.example`
to `frontend/.env` and adjust it if your backend runs elsewhere. When the
variable is unset, development falls back to `http://localhost:3000/api/v1`
and production uses the same-origin `/api/v1`.

Set `VITE_USE_MOCK=true` to run the auth/product list against the in-memory
mocks instead of the backend. `VITE_USE_MOCK_API=true` does the same for the
categories/suppliers screens.

## Reference

- [Vite docs](https://vite.dev) · [React docs](https://react.dev)
- [Tailwind CSS v4 docs](https://tailwindcss.com/docs)
- CI runs `npm ci` → `npm run lint` → `npm run build` here
  (`.github/workflows/ci.yml`).
