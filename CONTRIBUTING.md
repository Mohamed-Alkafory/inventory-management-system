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

Use this exact format:

```text
[#ISSUE_NUMBER] type: short description
```

Examples:

```text
[#12] feat: add product creation endpoint
[#15] fix: handle missing product records
[#18] docs: update local setup instructions
[#21] test: add inventory service tests
[#24] refactor: simplify product validation
```

Rules:

- Start with the related Issue number in brackets (`[#12]`). It links the
  work to its task; it does **not** close the Issue by itself.
- Use a lowercase type immediately after: `feat`, `fix`, `docs`, `test`,
  `refactor`, or `chore`.
- Write a concise English description in imperative mood ("add", not "adds"
  or "added"). Keep the whole line under ~72 characters when possible.

Common types:

| Type | Use for |
|---|---|
| `feat` | New features or endpoints |
| `fix` | Bug fixes |
| `docs` | Documentation only |
| `test` | Tests only |
| `refactor` | Code restructuring without behavior change |
| `chore` | Tooling, dependencies, housekeeping |

No related Issue? Open one first (or use the Task template) so the work is
tracked, then reference its number. Trivial fixes (typos, formatting) may use
`[#0]` only if the team agrees — otherwise create the Issue; it takes a
minute.

Do not confuse commit messages with pull request closing keywords. `Closes
#12` belongs in the **pull request description** (it closes the Issue on
merge); commit messages only reference the number in brackets.

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

## Project board

Work is tracked on a GitHub Projects board with these statuses:

`Backlog` → `Ready` → `In Progress` → `In Review` → `Done`

How the team uses it:

1. The maintainers prepare and prioritize tasks (`Backlog` → `Ready`).
2. Pick an available `Ready` task or propose a new Issue. Assign yourself —
   the assignee owns the implementation and keeps the Issue updated.
3. Move the Issue to `In Progress` and implement on a separate branch
   (see [Branches](#branches)).
4. Open a pull request linked to the Issue and move it to `In Review`.
5. After review approval and green CI, the PR is squash-merged and the Issue
   moves to `Done` (auto-closed when the PR uses `Closes #...`).

The board is manual GitHub setup (see [Branch protection and project
setup](#branch-protection-and-project-setup)); these rules describe how to
use it once it exists.

## Pull requests

- Fill in [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md):
  summary, related Issue, type of change, testing, and the checklist.
- Keep it small and focused; one concern per pull request.
- In **Related Issue**, write `Closes #<issue-number>` when the merge should
  close the Issue. This is the closing keyword — commit messages only carry
  the `[#...]` reference (see [Commits](#commits)).
- Confirm the checklist: conventions followed, no secrets, no unrelated
  changes, docs updated if behavior changed, UI screenshots attached for
  frontend changes.
- Link the Issue it resolves (`Closes #...`).
- In your first pull request, add yourself to the `AUTHORS` file.

## Review expectations

- At least **one approving review** is required before merge.
- Reviewers check correctness, scope, tests, and docs — be kind and specific.
- Authors should respond to every comment (fix, explain, or discuss) and
  re-request review when ready.
- Never push directly to `main`. Rebase only your own branch, never `main`.

## Labels

Apply labels so issues and pull requests are easy to find:

| Label | Meaning |
|---|---|
| `frontend` | React/Vite UI work |
| `backend` | NestJS API work |
| `database` | PostgreSQL, Prisma schema, or migrations |
| `bug` | Something is broken (pairs with the Bug report template) |
| `enhancement` | New feature or improvement (pairs with the Feature request template) |
| `documentation` | Docs only |
| `testing` | Tests or test infrastructure |
| `good first issue` | Small, well-defined — ideal for a first contribution |
| `help wanted` | The team is asking for help on this |

`bug` and `enhancement` are GitHub defaults (auto-applied by the issue
templates); the rest must be created once under Issues → Labels. Keep this
set — do not invent one-off labels without team agreement.

## Branch protection and project setup

These are one-time manual steps in GitHub Settings (not files in this repo).
Do not change repository settings without maintainer approval.

**Branch protection for `main`** (Settings → Branches → Add rule):

- Require a pull request before merging; dismiss stale approvals on new
  commits.
- Require at least one approving review.
- Require status checks to pass before merging: **`backend`** and
  **`frontend`** (the exact job names in `.github/workflows/ci.yml`).
  Require branches to be up to date before merging.
- Block force pushes and branch deletion.

Availability depends on the repository plan and your role: public
repositories on the free plan support required pull requests, required
reviews, required status checks, and force-push/deletion blocks. Some
advanced ruleset features need a paid plan — the list above stays within
what a student team normally has.

**Project board** (Projects → New project → Board): create the columns
`Backlog`, `Ready`, `In Progress`, `In Review`, `Done` and use them as
described in [Project board](#project-board).
