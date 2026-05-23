# controlroom

Public, read-only status board for every project in Pritika's portfolio. Eleven projects
share one Azure VM in northcentralus. ControlRoom polls each one's `/health` every 30
seconds, syncs commits from GitHub hourly, and accepts HMAC-verified deploy webhooks. A
single page shows what's running, what's healthy, and how fast things ship — live.

Design follows the Teenage Engineering catalog vocabulary: hard edges, monospace
labels, a single bright accent. Every project carries a device code (CR-01 ... CR-11).

Live at <http://135.232.183.50:3012/>.

## Quickstart

```sh
mise install                                    # pins Node 24
npm ci
docker compose -f docker-compose.local.yml up -d
cp .env.example .env                            # fill in GITHUB_PAT if you want sync
npm run migrate
npm run dev                                     # http://localhost:3012
```

```sh
pre-commit install                              # one-time
```

## What runs

- **Health poller** — recursive `setTimeout` every 30s; writes `health_pings` and pushes
  a `status_change` event into the SSE hub only when a project transitions. 24h rolling
  retention runs after each cycle.
- **GitHub sync** — hourly worker, fine-grained PAT, upserts the last 20 commits per
  live project into `commits_cache` with `ON CONFLICT DO NOTHING` (force-push safe).
- **Webhook receiver** — `POST /webhooks/github` verifies `X-Hub-Signature-256` with
  `timingSafeEqual`, then upserts deploy rows from `workflow_run` events named "deploy".
- **SSE stream** — `GET /api/stream` (in-memory EventEmitter hub, 15s heartbeat,
  exponential reconnect 1s -> 30s on the client).
- **Incidents** — markdown files in `content/incidents/*.md` loaded once at boot;
  `<script>` and `onerror` stripped via `isomorphic-dompurify`; an open `severity: high`
  incident becomes a banner on the home page.

## Endpoints

```
GET  /health                                    # liveness probe
GET  /api/public/status                         # status board feed (5s Redis cache)
GET  /api/public/projects/:slug/pings           # 24h ping window (?limit=)
GET  /api/public/projects/:slug/commits         # cached commits (?limit=)
GET  /api/public/projects/:slug/deploys         # cached deploys (?limit=)
GET  /api/public/stats                          # projects live, commits cached, deploys/7d
GET  /api/public/incidents                      # boot-time markdown
GET  /api/stream                                # SSE: status_change events
POST /webhooks/github                           # HMAC-verified workflow_run sink
```

A `getOnly` middleware returns `405` on any non-GET to non-internal paths. Helmet sets
CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.

## Deploy

OIDC-federated GitHub Actions logs into Azure with no stored credentials, then runs
`az vm run-command` to pull `main` and restart the docker-compose stack on the VM. The
deploy script probes `/health` for up to 60s after restart; fails the run if the new
container never reports healthy. See [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
and [`scripts/bootstrap-vm.sh`](scripts/bootstrap-vm.sh).

Secrets live in `/opt/pritika/_infra/.env` on the VM (Postgres + Redis passwords) and
get materialized into a per-project env file on every deploy. No secrets in this repo;
no secrets in GitHub Actions.

## Layout

```
.
├── .github/workflows/    ci.yml + deploy.yml + codeql + gitleaks + dependency-review
├── build/                Vite, Vitest, Tailwind, PostCSS configs
├── content/incidents/    Markdown files rendered on the home page
├── migrations/           Additive SQL (NNN_description.sql)
├── scripts/              bootstrap-vm.sh, file-all-issues.sh
├── src/
│   ├── server/           Express server (index, app, config, db, middleware, routes, services)
│   └── client/           React SPA (App, pages, components, hooks, lib)
├── tests/                Vitest workspace: server (node env) + client (jsdom)
├── PLAN.md               Build plan
└── CLAUDE.md             Per-repo agent instructions
```

## Stack

- **Runtime**: Node 24 (mise pinned)
- **Server**: Express 5, TypeScript strict + `noUncheckedIndexedAccess`
- **UI**: React 18 + Vite + Tailwind (custom mono/accent theme)
- **Data**: PostgreSQL 16, Redis 7 (shared containers on the VM)
- **Live**: Server-Sent Events
- **Tests**: Vitest workspace (server: node, client: jsdom)
- **CI**: GitHub Actions, OIDC federation to Azure, no stored secrets

## License

Source-available for portfolio review. Not yet licensed for reuse.
