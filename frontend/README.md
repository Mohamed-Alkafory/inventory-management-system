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

Open <http://localhost:5173>. `vite.config.ts` pins the port with
`strictPort: true`, so Vite fails instead of moving to another port when
`5173` is occupied. Path alias `@` maps to `src/` (see `vite.config.ts` and
`tsconfig.app.json`).

## Scripts (all run from `frontend/`)

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check (`tsc -b`) + production build into `dist/` |
| `npm run preview` | Serve the production build (after `npm run build`) |
| `npm run lint` | ESLint over the project |

## Environment

Development requests use the relative base URL `/api/v1` and Vite proxies
`/api` to `http://localhost:3010` (see `vite.config.ts`). This keeps browser
requests same-origin, so CORS is not involved during proxied development.

`VITE_API_URL` is optional and must include the global `/api/v1` prefix when
set. Use it for production or a non-proxied deployment, for example
`VITE_API_URL=https://api.example.com/api/v1`. When unset, the frontend uses
the relative `/api/v1` base URL. Copy `frontend/.env.example` to
`frontend/.env` if you need local overrides.

Set `VITE_USE_MOCK=true` to run the auth/product list against the in-memory
mocks instead of the backend. `VITE_USE_MOCK_API=true` does the same for the
categories/suppliers screens.

## Reference

- [Vite docs](https://vite.dev) · [React docs](https://react.dev)
- [Tailwind CSS v4 docs](https://tailwindcss.com/docs)
- CI runs `npm ci` → `npm run lint` → `npm run build` here
  (`.github/workflows/ci.yml`).
