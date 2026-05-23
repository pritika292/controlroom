# ControlRoom

Public, read-only status board for every project in Pritika's portfolio. Shows live
health, recent commits, and recent deploys per project.

## Quickstart

```sh
mise install          # pins Node 24 via .tool-versions
npm ci
docker compose -f docker-compose.local.yml up -d
cp .env.example .env  # fill in GITHUB_PAT
npm run migrate
npm run dev           # http://localhost:3012
```

One-time setup:

```sh
pre-commit install
```

## Architecture

See [`PLAN.md`](./PLAN.md) for the full build plan.

Stack: Node 24 + Express 5 + TypeScript strict, React 18 + Vite + Tailwind,
PostgreSQL 16 + Redis 7 (shared containers on the VM), Server-Sent Events for
live status push.

## Deploy

Automatic on push to `main`. See [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
OIDC-federated GitHub Actions authenticates to Azure; `az vm run-command` pulls
and restarts the container. No stored credentials.

## Layout

```
.
├── .github/workflows/   CI (ci.yml, codeql.yml, gitleaks.yml, dependency-review.yml)
├── build/               Vite + Vitest + Tailwind + PostCSS configs
├── src/
│   ├── server/          Express server (index.ts, app.ts, routes, services)
│   └── client/          React SPA (main.tsx, App.tsx, pages, components)
├── tests/               Vitest tests (server: node env, client: jsdom)
├── migrations/          Additive SQL files (NNN_description.sql)
├── PLAN.md              Full build plan
└── CLAUDE.md            Agent instructions
```

## License

Source-available for portfolio review. Not yet licensed for reuse.
