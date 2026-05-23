# controlroom

> Public, read-only status board for an eleven-project portfolio. Live health pings, GitHub deploy webhooks, SSE-pushed updates. One Azure VM, no admin surface.

[![ci](https://github.com/pritika292/controlroom/actions/workflows/ci.yml/badge.svg)](https://github.com/pritika292/controlroom/actions/workflows/ci.yml)
[![deploy](https://github.com/pritika292/controlroom/actions/workflows/deploy.yml/badge.svg)](https://github.com/pritika292/controlroom/actions/workflows/deploy.yml)
[![demo](https://img.shields.io/badge/demo-live-success)](https://controlroom.pritika.studio/)
[![codeql](https://github.com/pritika292/controlroom/actions/workflows/codeql.yml/badge.svg)](https://github.com/pritika292/controlroom/actions/workflows/codeql.yml)

![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/-Node.js%2024-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/-Express%205-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/-PostgreSQL%2016-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/-Redis%207-DC382D?logo=redis&logoColor=white)
![SSE](https://img.shields.io/badge/-Server--Sent%20Events-FF6A13)
![React](https://img.shields.io/badge/-React%2018-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/-Vite-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/-Tailwind%203-06B6D4?logo=tailwindcss&logoColor=white)
![Docker](https://img.shields.io/badge/-Docker-2496ED?logo=docker&logoColor=white)
![Azure](https://img.shields.io/badge/-Azure-0078D4?logo=microsoftazure&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)
![Vitest](https://img.shields.io/badge/-Vitest-6E9F18?logo=vitest&logoColor=white)
![Helmet](https://img.shields.io/badge/-Helmet-1F2937)

**Live**: <https://controlroom.pritika.studio/>  ·  every project carries a device code (CR-01 ... CR-11) in the Teenage Engineering catalog vocabulary.

---

## What it is

A public, read-only status board for eleven projects that share one Azure VM. It does three things that small status pages usually don't:

1. **Real live updates, not five-second polling.** A health poller flips a project's last-seen status; the poller publishes a `status_change` event into an in-memory SSE hub; every open browser repaints the dot before the next poll fires. The 5-second client poll is a fallback for when the SSE socket is mid-reconnect.

2. **Deploy timeline driven by GitHub webhooks.** `POST /webhooks/github` verifies `X-Hub-Signature-256` with `crypto.timingSafeEqual` and an `INSERT ... ON CONFLICT DO UPDATE`s deploy rows. `in_progress` and `success` events for the same SHA collapse into one row; non-deploy workflows and unknown repos are silently dropped.

3. **No admin surface at all.** Zero auth, zero sessions, zero write endpoints visible to the public internet — the one exception (`/webhooks/github`) is HMAC-pinned to a single GitHub key. The whole site is `GET` only, enforced by a `getOnly` middleware that 405s anything else.

Frontend follows the Teenage Engineering catalog vocabulary: hard edges, monospace labels, a single bright accent (#FF6A13). Project cards read like a device list rather than a SaaS dashboard.

---

## The live-update loop, mechanically

```
T+0s    health poller wakes (recursive setTimeout, not setInterval)
        └─ for each project in getLiveProjects():
              fetch <liveUrl>/health  with AbortSignal.timeout(5s)
                 ├─ 2xx + {ok:true}  → status = "up"
                 ├─ 2xx other        → status = "error"
                 ├─ non-2xx          → status = "down"
                 └─ AbortError       → status = "timeout"
              INSERT INTO health_pings (project, ts, status, latency_ms) VALUES (...)
              ┌─────────────────────────────────────────────────────┐
              │ lastStatus = lastStatusBySlug.get(slug)             │
              │ if lastStatus !== status:                           │
              │     lastStatusBySlug.set(slug, status)              │
              │     sseHub.publish("status_change", {slug, ...})    │ ◄── SSE clients fan out
              └─────────────────────────────────────────────────────┘
        └─ DELETE FROM health_pings WHERE ts < now() - interval '24 hours'
        └─ schedule(); // recursive setTimeout, no overlap

T+~1s   browser EventSource gets the status_change event
        └─ useStatus.refresh() fires a /api/public/status fetch
        └─ React re-renders the affected ProjectCard
        └─ StatusDot transition-colors animates over 200ms
```

Two architectural choices that make this work:

- **Recursive `setTimeout`, not `setInterval`.** A poll that takes 35 seconds while the interval is 30 would overlap with the next tick under `setInterval`, piling parallel polls forever. The recursive form only schedules the next tick after the current one finishes, with the work wrapped in `try/catch` so one bad poll doesn't kill the loop.

- **Status-flip detection, not "broadcast every result".** The poller keeps `lastStatusBySlug: Map<string, status>` in memory and only publishes when the value differs. Without this the SSE channel would be a 30-second firehose of repeated "shortlive is still up" events that the UI throws away anyway.

End-to-end latencies measured live from the open internet to the VM in northcentralus:

| | p50 |
|---|---|
| `GET /health` | ~115 ms |
| `GET /api/public/status` (Redis cache hit) | ~120 ms |
| `GET /api/public/stats` (Redis cache hit) | ~130 ms |
| Health transition → SSE → browser repaint | ~1.5 s (capped by the 30 s polling window) |

---

## Azure infrastructure

One subscription, one resource group, one always-on VM. The cloud-native bits are the security primitives, not the data plane.

| Azure service | Used for |
|---|---|
| **Azure VM** (`B2as_v2`, AMD, Ubuntu 22.04, northcentralus) | Shared host for the entire 11-project portfolio. Docker-compose stack: controlroom + shortlive + sibling apps + shared Postgres 16 + shared Redis 7. ~$30/mo on Visual Studio Enterprise credits. |
| **Azure Entra ID + Federated Identity Credentials** | Zero stored Azure credentials in the repo. GitHub Actions exchanges its workflow OIDC token for a short-lived Azure access token via `azure/login@v2`. Per-repo FIC restricted to `repo:pritika292/controlroom:ref:refs/heads/main`. |
| **Azure RBAC** | The federated app principal has `Virtual Machine Contributor` on one VM only. Can't create resources, can't read secrets, can't touch other RGs. |
| **System-assigned Managed Identity (on the VM)** | The VM authenticates to Key Vault via its own identity. No keys, no service-principal secrets, nothing to rotate. |
| **Azure Key Vault** (`pritika-portfolio-kv`) | RBAC-mode (not access-policy mode). Holds shared Postgres + Redis credentials. Bootstrap script reads them at deploy time via Managed Identity. |
| **`az vm run-command`** | The deploy primitive. GitHub Actions invokes it with an inline shell script that `git pull`s, rebuilds the container, and restarts the compose stack. No SSH key in CI. |

Frontend infrastructure: **none**. The React bundle is built at container-build time and served by the same Express process that handles the API and SSE.

### Why this shape

Could have used Azure Database for PostgreSQL, Azure Cache for Redis, Azure Container Apps, Azure Front Door. Didn't, deliberately:

- **Cost.** Managed Postgres alone is ~$50/mo for the basic tier. The whole VM is cheaper.
- **One blast radius.** When something breaks there's one place to look. `docker compose logs controlroom` reveals the world.
- **Real understanding signal.** "I deployed it on Container Apps" doesn't prove I run Postgres. Running them myself does.
- **The security story is the same.** OIDC, Managed Identity, Key Vault, RBAC — all the things a hiring manager actually cares about — work identically whether the database is a managed service or a sidecar container.

The codebase is structured for an easy swap: pool connection strings come from env vars, SSE is plain `EventEmitter` rather than Socket.IO, no Azure SDKs are imported in the request path.

---

## Distributed-systems patterns

Each one named, each justified by the failure mode it solves.

| Pattern | Implementation | What it prevents |
|---|---|---|
| **Recursive `setTimeout` poller** | Schedule next tick only in `.finally()` of the current tick | Overlapping polls when a single fetch hangs; one bad poll doesn't kill the loop |
| **Status-flip detection** | `Map<slug, lastStatus>` consulted before every `sseHub.publish` | SSE clients only see real transitions; not 30-second heartbeats |
| **In-memory SSE hub** | Single-process `EventEmitter`, `maxListeners=0`, fan-out on `publish` | No Redis pub/sub tax for a single-instance service; ~10 LOC |
| **Subscribe-before-route SSE** | `webhooksGithub` router is mounted before `express.json()` | Raw body remains available for HMAC verification on the webhook path |
| **HMAC with `timingSafeEqual`** | `crypto.timingSafeEqual(Buffer.from(provided,'hex'), Buffer.from(expected,'hex'))` | Constant-time signature compare; no timing-attack surface |
| **Force-push-safe commit cache** | `INSERT INTO commits_cache ... ON CONFLICT (project, sha) DO NOTHING` | An upstream history rewrite can't quietly mutate cached commits |
| **Workflow-run upsert with collapsed states** | `ON CONFLICT (project, sha) DO UPDATE SET status = EXCLUDED.status, ...` | `in_progress` and `success` for the same run collapse to one row |
| **Cache-TTL matched to data velocity** | 5 s on status (poll cadence is 30 s); 15 s on deploys (webhooks are bursty); 30 s on commits (sync is hourly) | Wasteful refetches without going stale for the obvious use case |
| **24-hour rolling retention** | `DELETE FROM health_pings WHERE ts < now() - interval '24 hours'` after every poll cycle | `health_pings` stays cheap forever; the index on `(project, ts DESC)` makes the sweep almost free |
| **GET-only middleware** | `405` on any non-GET unless the path is `/webhooks/github`; HEAD + OPTIONS pass per RFC | Whole public API is read-only by enforcement, not by convention |
| **Markdown sanitization at the boundary** | `marked` parses; `isomorphic-dompurify` strips `<script>`, `onerror`, etc. — before the HTML ever crosses the wire | `dangerouslySetInnerHTML` on the client is safe because the bytes were sanitized server-side |
| **OIDC-federated deploys** | `azure/login@v2` exchanges the workflow JWT for a short-lived Azure token; FIC subject claim pinned to `main` | No `AZURE_CREDENTIALS` JSON in the repo; nothing to leak or rotate; feature branches can't deploy |
| **Migration ledger** | `migrations/NNN_*.sql` applied in lexical order, tracked in a `_migrations` table; container `CMD` runs migrate before the server | Schema state provable from the ledger; safe to re-run on every container start |
| **Static project registry as source of truth** | `src/server/projects.ts` exports a frozen array; webhook + poller + status endpoint all read from it | Unknown repos get dropped, new projects need a code change (which is the point) |

---

## Architecture

```
                                          GitHub  workflow_run
                                          (any deploy workflow)
                                                 │
                                                 │ HMAC: X-Hub-Signature-256
                                                 ▼
   ┌────────────── POST /webhooks/github (raw body, before express.json) ────────────┐
   │   timingSafeEqual the HMAC ─► verify event === "workflow_run"                   │
   │                            ─► verify workflow_run.name === "deploy"             │
   │                            ─► look up repo full_name in projects.ts             │
   │                            ─► INSERT INTO deploys ... ON CONFLICT DO UPDATE     │
   └─────────────────────────────────────────────────────────────────────────────────┘

                              ┌────────────────────────────┐
                              │  Express :3012             │
   visitor                    │                            │
   browser ──────HTTP────────►│  GET  /                    │
                              │  GET  /api/public/status   │  Redis cache 5s
                              │  GET  /api/public/stats    │  Redis cache 30s
                              │  GET  /api/public/projects │  Redis cache 5-30s
                              │       /:slug/{pings,       │
                              │        commits, deploys}   │
                              │  GET  /api/public/incidents│  in-mem (boot-loaded)
                              │  GET  /api/stream          │  SSE (text/event-stream)
                              │  POST /webhooks/github     │  ◄── only POST in the app
                              └──┬─────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
       PostgreSQL 16         Redis 7              SSE hub
       db: controlroom       db 12                (EventEmitter,
       ┌─────────────┐       ┌──────────────┐     in-memory)
       │health_pings │       │cache:public_*│         │
       │deploys      │       │cache:pings:* │         │  status_change
       │commits_cache│       │cache:commits │         │  hello
       │_migrations  │       │cache:deploys │         │  : keep-alive every 15s
       └─────────────┘       └──────────────┘         │
              ▲                                       │
              │                                       ▼
   ┌──────────┴──────────┐                  ┌───────────────────┐
   │ health poller       │                  │ browser:          │
   │ recursive setTimeout│                  │ EventSource       │
   │ every 30s           │                  │ exp backoff       │
   │ ┌──────────────────┐│                  │ 1s→2s→4s→...→30s  │
   │ │ for each project ││                  └────────┬──────────┘
   │ │   fetch /health  ││                           │
   │ │   classify       ││                           │ on status_change:
   │ │   INSERT ping    ││                           │   refetch /api/public/status
   │ │   if status flip:││                           │   repaint cards
   │ │     hub.publish  ││                           │
   │ └──────────────────┘│                  ┌────────┴──────────┐
   │ DELETE > 24h        │                  │ React SPA         │
   └──────┬──────────────┘                  │ status board      │
          │                                 │ /p/:slug detail   │
          │ fetch                           │ stats strip       │
          ▼                                 │ incident banner   │
   ┌──────────────────┐                     │ STATUS / OFFLINE  │
   │ shortlive  :3010 │                     │ chip in header    │
   │ (and 10 more     │                     └───────────────────┘
   │ when they ship)  │
   └──────────────────┘

   ┌────────────────────────┐ hourly         ┌───────────────────────┐
   │ GitHub sync worker     │ ────────────►  │ api.github.com        │
   │ for each live project: │                │ /repos/{repo}/commits │
   │   PAT Bearer auth      │ ◄───────────── │                       │
   │   upsert commits_cache │  per_page=20   └───────────────────────┘
   └────────────────────────┘
```

---

## Data model

```sql
-- Migration runner ledger; one row per applied .sql file, in lex order.
CREATE TABLE _migrations (
  id          TEXT        PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Health probe results. 24h rolling retention swept after every poll.
CREATE TABLE health_pings (
  project     TEXT        NOT NULL,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  status      TEXT        NOT NULL CHECK (status IN ('up','down','timeout','error')),
  latency_ms  INTEGER,
  PRIMARY KEY (project, ts)
);
CREATE INDEX health_pings_project_ts_idx ON health_pings (project, ts DESC);

-- Webhook-driven deploy timeline. Same SHA collapses (in_progress -> success).
CREATE TABLE deploys (
  project      TEXT        NOT NULL,
  sha          TEXT        NOT NULL,
  actor        TEXT,
  started_at   TIMESTAMPTZ NOT NULL,
  finished_at  TIMESTAMPTZ,
  status       TEXT        NOT NULL
               CHECK (status IN ('queued','in_progress','success','failure','cancelled')),
  run_url      TEXT,
  PRIMARY KEY (project, sha)
);
CREATE INDEX deploys_project_started_idx ON deploys (project, started_at DESC);

-- Hourly GitHub sync; force-push-safe via ON CONFLICT DO NOTHING.
CREATE TABLE commits_cache (
  project  TEXT        NOT NULL,
  sha      TEXT        NOT NULL,
  author   TEXT,
  message  TEXT        NOT NULL,
  ts       TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (project, sha)
);
CREATE INDEX commits_cache_project_ts_idx ON commits_cache (project, ts DESC);
```

### Redis (logical DB 12)

A Zod `.refine()` in `config.ts` crashes the server on boot if `REDIS_URL` doesn't end in `/12` in production. Cross-project DB collisions in the shared Redis are silent and miserable to debug; better to fail loud.

| Key | Type | Purpose |
|---|---|---|
| `controlroom:cache:public_status` | string + EX 5 | Cached `/api/public/status` JSON body |
| `controlroom:cache:public_stats` | string + EX 30 | Cached `/api/public/stats` body |
| `controlroom:cache:pings:{slug}` | string + EX 5 | Cached 24h ping window per project |
| `controlroom:cache:commits:{slug}:{limit}` | string + EX 30 | Cached commits feed per project + limit |
| `controlroom:cache:deploys:{slug}:{limit}` | string + EX 15 | Cached deploy timeline per project + limit |

### Incidents

Markdown files under `content/incidents/*.md`. Loaded once at boot. Frontmatter shape:

```markdown
---
title: shortlive returned 500 for 8 minutes
project: shortlive          # slug from projects.ts
severity: high              # low | medium | high
opened: 2026-05-23T08:30:00Z
closed:                     # leave empty while open
---

Body in markdown. Sanitized server-side via isomorphic-dompurify before crossing the wire.
```

The home page renders the most recent open `severity: high` incident as a banner. Reload happens via container restart on deploy (`git pull && docker compose up -d --build`) — no `chokidar` dep.

---

## CI/CD

Sequential GitHub Actions chain (`lint → typecheck → docker-build → test`) — fails fast, never burns the test job on a typo. On a successful run on `main`, `deploy.yml` fires via `workflow_run`:

```
GitHub Actions runner
  │
  ├─ azure/login@v2  (OIDC: exchange the workflow JWT for a short-lived Azure token)
  │
  ├─ az vm run-command invoke
  │     --resource-group pritika-portfolio-rg
  │     --name pritika-portfolio-vm
  │     --scripts @vm-deploy.sh
  │
  ▼
VM:  git fetch && reset --hard origin/main
     scripts/bootstrap-vm.sh         # materializes /opt/pritika/_infra/controlroom.env
     docker compose up -d --build
     loop curl http://localhost:3012/health for up to 60 s; fail the run on no 2xx
```

No SSH key in GitHub. No `AZURE_CREDENTIALS` JSON. Zero long-lived credentials anywhere. FIC subject claim restricts the federation to `repo:pritika292/controlroom:ref:refs/heads/main`, so a fork or feature branch cannot deploy.

Per-project secrets (`GITHUB_PAT`, `GITHUB_WEBHOOK_SECRET`) live in `/opt/pritika/_infra/controlroom.env` on the VM, materialized by `bootstrap-vm.sh` on every deploy. The webhook secret is generated with `openssl rand -hex 32` on first run and preserved on subsequent runs so signatures stay valid across rebuilds.

---

## Run locally

```bash
mise install                                         # Node 24 per .tool-versions
npm ci
cp .env.example .env                                 # GITHUB_PAT optional in dev
docker compose -f docker-compose.local.yml up -d     # local Postgres + Redis
npm run migrate
npm run dev                                          # http://localhost:3012
```

The root `docker-compose.yml` is the **production** compose used by `az vm run-command`. For local dev always pass `-f docker-compose.local.yml`.

```bash
pre-commit install                                   # once per clone: gitleaks + hygiene hooks
```

---

## Tests

- `npm test` runs the full Vitest workspace (server in node env, client in jsdom, integration tests against local Postgres + Redis).
- Client-only: `npx vitest run -c build/vitest.config.ts --project client`.

Coverage spans: config Zod schema + prod guards + secret redaction, migration runner idempotency, health poller status classification + status-flip publishing + 24h retention, SSE hub subscribe/publish/unsubscribe, webhook HMAC verify with `timingSafeEqual`, workflow filtering, project allowlist, deploy row upsert, public status endpoint with Redis cache, project pings + commits + deploys endpoints with cache, stats endpoint, incident markdown loader + script/onerror sanitization + dotfile skip, and every React component touched on the home and detail pages.

---

## Honest limitations

- **No HTTPS.** Plain HTTP on the public IP. Helmet's default CSP `upgrade-insecure-requests` and HSTS are both explicitly disabled in `securityHeaders.ts` because either would brick the site without a TLS terminator. Both flip back on when Caddy + Let's Encrypt land in front (next item).
- **One region, one VM.** No HA. Acceptable for a portfolio. Moving Postgres to Azure Database for PostgreSQL with a read replica is a one-config-change away.
- **SSE hub is single-process.** A second app instance would not share subscribers. Real fan-out would move the hub to Redis pub/sub; the codebase already imports `ioredis` for caching, so the migration is local. Not worth it at single-instance scale.
- **GitHub commit cache is hourly.** A push lands on the home page after the next sync tick. The deploy timeline updates in real time via webhook, so the "what shipped" answer is always fresh; the "what was committed" answer can be 60 min stale.
- **Incidents reload on container restart only.** Filed by `git push`; visible after the next deploy. By design (no editor surface = no auth surface).
- **No CSP nonce.** Inline `<script>` for the theme bootstrap is blocked by `script-src 'self'`; theme defaults to dark on first paint until React mounts. A `nonce-` based CSP would let the bootstrap run again. Cosmetic.

---

## What's next

- **Caddy + Let's Encrypt** in front for HTTPS, then re-enable HSTS + `upgrade-insecure-requests`. The compose layout already isolates the Express app behind a docker network, so the change is config-only.
- **Per-project icons** keyed off the project code, in the same flat-mono catalog style.
- **A Cost panel** consuming the Azure Cost Management API server-side. Out of v1 because budget figures are private; lives behind a hostname-gate when it lands.
- **Public commit history** richer than "last five" — a per-project timeline view at `/p/:slug/log`.

---

## License

Source-available for portfolio review. Not yet licensed for reuse.
