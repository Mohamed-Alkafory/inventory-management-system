# Contributing

Thanks for helping with the Inventory Management System. This guide covers
everything you need to contribute. New here? Start with the
[README](README.md) setup instructions, then come back.

Everyone participating is expected to follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

- **Code**: pick an open issue or propose a small, well-scoped change.
- **Documentation**: setup guides, API docs in [`docs/`](docs/), typo fixes.
- **Issues**: report bugs or request features using the issue templates.
- **Review**: review open pull requests — reviews are contributions too.

If you are unsure where to start, open an issue and ask. Small pull requests
are easier to review and merge than large ones.

## Development setup

Follow [README](README.md) (root), plus the folder guides
[`backend/README.md`](backend/README.md) and
[`frontend/README.md`](frontend/README.md):

```bash
cp .env.example .env
cp backend/.env.example backend/.env
docker compose up -d
cd backend && npm ci && cd ..
cd frontend && npm ci && cd ..
```

Always install with `npm ci` inside `backend/` or `frontend/` (each has its own
`package.json` + `package-lock.json`). There is no installable package at the
repo root.

## Branches

Trunk-based: `main` is always stable. Do all work on short-lived branches:

- `feat/...` — new features (`feat/products-api`)
- `fix/...` — bug fixes
- `test/...` — tests only
- `docs/...` — documentation only
- `chore/...` — tooling, dependencies, housekeeping

```bash
git switch main && git pull --ff-only origin main
git switch -c feat/products-api
# ... work + commit ...
git fetch origin && git rebase origin/main
git push -u origin feat/products-api   # use --force-with-lease after a rebase
```

Open a pull request against `main`, wait for CI and review, then
**squash and merge**.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` `fix:` `test:` `docs:` `refactor:` `chore:`
- Example: `feat(products): add product creation endpoint`

Write commits that explain *why*, not just *what*. Keep each commit focused.

## Coding conventions

- TypeScript everywhere; follow the existing style in each folder.
- Backend: format with `npm run format` (Prettier), lint with `npm run lint`
  (oxlint over `src/` and `test/`).
- Frontend: lint with `npm run lint` (ESLint). Fix type errors — do not bypass
  `tsc` checks.
- Never commit `.env` files, credentials, tokens, or other secrets. Only
  `.env.example` placeholders belong in Git.
- Never hand-edit `package-lock.json`; regenerate with `npm install` in the
  owning folder and commit the result.
- No database resets or volume deletions to "fix" local problems.

## Tests

Run the checks for every change, from the owning folder:

```bash
# Backend (from backend/)
npm run lint
npm test            # unit tests (Vitest)
npm run test:e2e    # end-to-end tests (Vitest)
npm run build       # production build

# Frontend (from frontend/)
npm run lint
npm run build       # type-check + production build
```

These are the same commands CI runs (`.github/workflows/ci.yml`). A pull
request must arrive with CI green. Add or update tests alongside behavior
changes; there is no need to invent tests for unrelated code.

## Issues

- Search existing issues before opening a new one.
- Use the template that fits: **Bug report**, **Feature request**, or **Task**.
- Include steps to reproduce (bugs), expected vs. actual behavior, and your
  environment (OS, Node version, Docker version).

## Pull requests

- Fill in the pull request template: summary, changes, testing, related issue.
- Keep it small and focused; one concern per pull request.
- Confirm the checklist: conventions followed, no secrets, no unrelated
  changes, docs updated if behavior changed.
- Link the issue it resolves (`Closes #...`).
- In your first pull request, add yourself to the `AUTHORS` file.

## Review expectations

- At least **one approving review** is required before merge.
- Reviewers check correctness, scope, tests, and docs — be kind and specific.
- Authors should respond to every comment (fix, explain, or discuss) and
  re-request review when ready.
- Never push directly to `main`. Rebase only your own branch, never `main`.
