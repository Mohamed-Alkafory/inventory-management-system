# Frontend — React + Vite

React 19 + TypeScript + Vite (+ Tailwind CSS, React Router, React Query,
Axios, React Hook Form + Zod). Full local setup lives in the
[root README](../README.md).

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
| `npm test` | Vitest test suite |

## Mocks vs the real backend

Everything is controlled by the single `VITE_USE_MOCK` variable in
`frontend/.env`. Mocks are enabled only when its value is exactly `true`.
Copy `frontend/.env.example` to `frontend/.env` for local overrides.

**With the real backend**

- Run the backend on `http://localhost:3010` (see the root README).
- Leave `VITE_USE_MOCK` unset or set it to `false`.
- `VITE_API_URL` is optional and must include the `/api/v1` prefix when set.
  When unset, the frontend uses the relative `/api/v1` base URL and Vite
  proxies `/api` and `/uploads` to `http://localhost:3010` (see
  `vite.config.ts`), so requests stay same-origin and CORS is not involved.
- Use `VITE_API_URL` for production or a non-proxied deployment, for example
  `VITE_API_URL=https://api.example.com/api/v1`.

**With mocks (no backend)**

- Set `VITE_USE_MOCK=true` in `frontend/.env` and restart `npm run dev`.
- All screens use in-memory data that resets on page reload. Accounts created
  through the Register page persist in this browser's localStorage.
- Demo accounts (email only — the passwords live in the mock source):

| Role | Email |
|---|---|
| Admin | `admin@prodexa.com` |
| Staff | `staff@prodexa.com` |
| Support | `support@prodexa.com` |
| Customer | `customer@prodexa.com` |

## Docker

The image is multi-stage: Node builds `dist/`, then Nginx serves it.

```bash
# From the repository root:
docker compose up --build -d
# -> http://localhost:8080
```

Nginx has the SPA fallback to `index.html` and proxies `/api/` and
`/uploads/` to the `backend` service, so the default relative `/api/v1`
base URL works without CORS. To bake an external API URL into the bundle:

```bash
docker build --build-arg VITE_API_URL=https://api.example.com/api/v1 -t prodexa-frontend ./frontend
```

## Reference

- [Vite docs](https://vite.dev) · [React docs](https://react.dev)
- [Tailwind CSS v4 docs](https://tailwindcss.com/docs)
- CI runs `npm ci` · `npm run lint` · `npm run build` and builds the Docker
  image here (`.github/workflows/ci.yml`).
