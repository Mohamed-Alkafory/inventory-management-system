# Contributing

## Branches
Trunk-based: `main` دايماً مستقر. كل مهمة على فرع قصير العمر:
`feat/...`, `fix/...`, `test/...`, `docs/...`, `chore/...`

## Workflow
```bash
git switch main && git pull --ff-only origin main
git switch -c feat/products-api
# ... work + commit ...
git fetch origin && git rebase origin/main
git push -u origin feat/products-api   # (أو --force-with-lease بعد rebase)
```
افتح PR إلى `main`، استنى الـ CI والمراجعة، وبعدها **Squash and merge**.

## Commits (Conventional Commits)
`feat:` `fix:` `test:` `docs:` `refactor:` `chore:`
مثال: `feat(products): add product creation endpoint`

## Rules
- ممنوع push مباشر على `main`.
- Rebase على فرعك فقط، مش على `main`.
- PR صغير ومحدد، ومراجعة واحدة على الأقل.
- ممنوع رفع `.env` أو أي secrets.
