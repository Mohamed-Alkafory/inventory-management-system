# Security Policy

## Supported versions

This project is early-stage and tracks a single development line. Security
fixes, when needed, are applied to `main`:

| Version | Supported |
|---|---|
| `main` (latest) | Yes |

## Reporting a vulnerability

**Do not open a public issue for a suspected vulnerability.** Public issues
disclose the problem to everyone before a fix exists.

Instead, contact the project maintainers privately through GitHub (see
[AUTHORS](AUTHORS)). Include:

- What is affected (frontend, backend, dependencies, Docker setup).
- Steps to reproduce or a proof of concept.
- Anything you already know about impact or a possible fix.

Please give the team a reasonable chance to address the report before any
public disclosure. No fixed response time is promised — this is a student
team project — but every private report will be read.

> Maintainers: consider enabling GitHub's **Private vulnerability reporting**
> (repository Settings → Security) and, once a dedicated security contact
> exists, list it here.

## Scope notes

- Secrets (`.env` contents, tokens, credentials) must never be committed. If
  one leaks into Git history, treat it as compromised: rotate it immediately
  and tell the team.
- Dependency vulnerabilities surface through `npm audit` and CI; keep
  `package-lock.json` files committed and up to date so fixes are traceable.
