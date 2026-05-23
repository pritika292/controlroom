# Plan — ControlRoom (public-only portfolio status board)

## Context

ControlRoom is a new portfolio project: a **public, read-only** status board that monitors all of
Pritika's other projects (shortlive today, ten more later). It's the meta piece in the portfolio —
a single URL that shows founders "here's everything I've built, here's what's healthy right now,
here's how fast I ship."

**Scope deliberately narrowed.** The original design had an admin console (Google OAuth, sidecar
container restarts, log tails, cost dashboard, incident editor). We've **cut all of that** for
v1. Reasons:

- **Security**: no admin surface means no auth to break, no sidecar to compromise, no Docker
  socket exposed anywhere. The site is HTML + JSON over read-only API calls. The blast radius if
  someone breaks in is "they can read public GitHub data" — which they could read directly anyway.
- **Time**: Pritika is time-constrained. Build the impressive thing first; admin functionality
  can come later (or never — Pritika can SSH the VM if she needs to restart a container).
- **Story**: a public dashboard is a stronger demo to founders than a login-walled console they
  can't see.

**This plan is intended to be picked up by a fresh Claude session with no prior context.**
Everything needed — repo creation, infra setup, feature breakdown — lives below or behind file
paths cited inline. Read this file first, then `shortlive/` (path below) for patterns to copy,
then this repo's `docs/` for conventions.

**Security is still non-negotiable, just simpler.** No secrets in the repo, no secrets in CI, no
admin routes to leak, no write endpoints exposed to the internet. See the *Security
Considerations* section.

---

## Reference repositories (read these before starting)

| Repo | Path | What to use it for |
|------|------|--------------------|
| **portfolio-control** (parent / private) | `/Users/abdul/Library/Mobile Documents/com~apple~CloudDocs/Study/PProjects` | Conventions: ports (`PLAN.md`), Azure infra (`docs/01-azure-infrastructure.md`), IAM (`docs/02-iam-security.md`), OIDC deploy flow (`docs/03-cicd-oidc.md`), deployment layout (`docs/05-deployment-strategy.md`), pre-commit (`docs/06-security-pre-commit.md`), monitoring (`docs/07-monitoring.md`), commit style (`scripts/templates/CLAUDE.md`) |
| **shortlive** (reference impl) | `/Users/abdul/Library/Mobile Documents/com~apple~CloudDocs/Study/portfolio-projects/shortlive` | The canonical pattern for every piece of infrastructure ControlRoom needs. Copy + adapt verbatim. |

### Specific shortlive files to mirror (the full CI/CD + tooling stack)

Copy and adapt every one of these. Same toolchain top-to-bottom.

| File | Use for |
|------|---------|
| `.github/workflows/ci.yml` | 4-job sequential CI chain: lint → typecheck → test (with Postgres + Redis services) → build. Mirror the `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` env, the `npm ci` cache, the service block, and the matrix-free single Node 24 build. |
| `.github/workflows/deploy.yml` | OIDC `azure/login@v2` then `az vm run-command invoke` running an inline `vm-deploy.sh`. Health-check `curl -fsS http://localhost:3012/healthz` at the end. **No secrets in the workflow file or repo settings.** |
| `.github/workflows/codeql.yml` | Static analysis for JS/TS on PRs. Mirror shortlive. |
| `.github/workflows/npm-audit.yml` (or job inside ci) | Dependency vulnerability scan. Fail on high+ severity in prod deps. |
| `.github/dependabot.yml` | Weekly dependency updates, grouped by ecosystem. |
| `.github/pull_request_template.md` | Summary + Test plan checkbox layout. |
| `Dockerfile` | Multi-stage builder/runner; `node:24-alpine`; runs `npm run migrate` before `node dist/server.js`; non-root user. |
| `docker-compose.yml` | Joins the external `pritika` network, `env_file: /opt/pritika/_infra/controlroom.env`, `mem_limit: 384m`, `restart: unless-stopped`, only port 3012 published. |
| `docker-compose.local.yml` | Postgres 16-alpine + Redis 7-alpine with named volumes for local dev. |
| `.pre-commit-config.yaml` | gitleaks v8.21.0, detect-private-key, trailing-whitespace, end-of-file-fixer, check-yaml, check-added-large-files, shellcheck. |
| `.gitleaks.toml` | Custom allowlist (if shortlive has one) — copy. |
| `eslint.config.js`, `tsconfig.json`, `tsconfig.build.json` | TypeScript strict + `noUncheckedIndexedAccess`; flat-config ESLint with typescript-eslint strict. |
| `build/vite.config.ts`, `build/vitest.config.ts`, `build/tailwind.config.ts`, `build/postcss.config.cjs` | Build configs under `build/` so root stays clean. Vitest workspace separates server (node env) from client (jsdom). |
| `package.json` | Script names: `dev`, `build`, `start`, `migrate`, `test`, `test:watch`, `lint`, `lint:fix`, `format`, `typecheck`. Inlined Prettier config. Engines: `"node": ">=24"`. |
| `mise.toml` | Pin `node = "24"`. |
| `migrations/001_*.sql` … | Naming convention `NNN_short_description.sql`. Always additive. |
| `src/server/db/migrate.ts` | Migration runner with `_migrations` ledger table; idempotent; runs at container boot. |
| `src/server/config.ts` | Zod schema + prod-pepper-style guard pattern (reuse for `GITHUB_PAT` guard). |
| `scripts/bootstrap-vm.sh` | Generates `/opt/pritika/_infra/<project>.env` by pulling secrets from Key Vault via Managed Identity. Adapt for `controlroom.env`. |
| `README.md` structure | Quickstart → Architecture → Deploy → Layout. Mirror tone (terse, no marketing copy). |
| `CLAUDE.md` | Per-repo instructions for future Claude sessions in this codebase. |
| `.editorconfig`, `.dockerignore`, `.gitignore`, `.nvmrc` | Copy verbatim. |

### Specific portfolio-control docs to follow

- `PLAN.md` — ControlRoom is assigned **port 3012**. Add the entry.
- `docs/01-azure-infrastructure.md` — RG `pritika-portfolio-rg`, VM `pritika-portfolio-vm`
  (B2as_v2, northcentralus, IP `135.232.183.50`), Key Vault `pritika-portfolio-kv`.
- `docs/02-iam-security.md` — VM has System-Assigned Managed Identity with Key Vault Secrets User.
- `docs/03-cicd-oidc.md` — Federated credential pattern
  `repo:pritika292/controlroom:ref:refs/heads/main`. Add this to `pritika-github-deployer`.
- `docs/05-deployment-strategy.md` — Shared `pritika` docker network; service config files at
  `/opt/pritika/_infra/<project>.env`; `mem_limit: 384m`.
- `docs/06-security-pre-commit.md` — gitleaks + CodeQL + npm audit.
- `scripts/templates/CLAUDE.md` — Commit style: imperative, ≤72 char subject, no AI fingerprints,
  no em-dashes, no "Generated with Claude Code" footer.

---

## Security considerations (still non-negotiable, just simpler)

The threat model is now: there are **no write endpoints** exposed to the public internet, and
**no admin surface to compromise**. An attacker who breaks in can read public GitHub data,
which they could read directly anyway. The remaining concerns:

### Secrets

- **No secrets in the repo. Ever.** Pre-commit gitleaks blocks it. CI re-runs gitleaks. CodeQL
  catches obvious patterns.
- **No secrets in GitHub Actions secrets.** Only the GitHub PAT lives outside the repo, and it
  lives in **Azure Key Vault**, pulled to the VM at boot via Managed Identity.
- **GitHub PAT** is **fine-grained**, scoped to `pritika292/*` repos only, with **read-only**
  permissions on Contents, Metadata, Issues, Pull Requests, Actions. Expires every 90 days.
- **PAT never sent to the browser.** All GitHub API calls happen server-side; the browser sees
  only the resulting JSON.
- **Refuse to boot in production with placeholder values.** Mirror shortlive's `IP_HASH_PEPPER`
  guard for `GITHUB_PAT`. Crashes fast > silent insecurity.
- **No logging of secrets.** Logger middleware redacts anything with `token`, `key`, `secret` in
  the field name.

### Network surface

- **Only port 3012 published to the host.** Postgres / Redis reachable only on the `pritika`
  docker network.
- **Azure NSG**: only ports 22 (SSH) and the per-project app ports open. Verify with
  `az network nsg rule list`.
- **SSH**: key-only, no password auth. Pritika's key only.
- **TLS**: Caddy in front (Tier 6). Until then, HTTP is fine because the site is fully public.
- **Strict security headers** via `helmet`: CSP (script-src self), `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` empty,
  `Strict-Transport-Security` once TLS lands.
- **CORS**: deny by default. ControlRoom serves its own SPA.

### Read-only at every layer

- **No `POST`, `PATCH`, `DELETE` routes** anywhere in the public API. Only `GET`. Add a
  middleware that returns 405 on any non-GET to non-internal paths as a safety net.
- **Database access is read-mostly**: only the health-poller and the GitHub-sync worker write,
  and they're internal background workers, not HTTP-reachable from the internet.
- **The `webhooks/github` endpoint is the one exception** (GitHub posts deploy events to it).
  HMAC-verified with a secret from Key Vault; rejects any payload with a bad signature.

### Code-level defences

- **Input validation everywhere via Zod.** Every route handler `.parse()`s query params.
- **SQL via parameterised queries only.** `pg` library; no string interpolation.
- **No sub-process execution.** ControlRoom never shells out.
- **Markdown rendering for incident posts**: use `marked` + `DOMPurify`. Never
  `dangerouslySetInnerHTML` on raw input. (Incident posts are committed Markdown files in the
  repo — not user input — but sanitise anyway as belt-and-braces.)
- **Rate limiting on the webhook endpoint and public API** (60/min/IP via `express-rate-limit`
  backed by Redis). Prevents simple DoS noise.

### Supply chain

- **`npm ci` only in CI.** `package-lock.json` committed.
- **Dependabot weekly** for security updates.
- **`npm audit --omit=dev` in CI**, fails on `high` or `critical`.
- **CodeQL** scans on every PR.
- **Pin GitHub Actions to commit SHAs**, not floating tags.
- **Container base image** pinned to a specific SHA in the Dockerfile.

### Azure / cloud posture

- **No Azure credentials in the repo.** OIDC federated identity is the only auth path.
- **VM Managed Identity has minimum-required RBAC**:
  - Key Vault Secrets User on `pritika-portfolio-kv` (read only).
  - Reader on the resource group (so the public board can later show "VM uptime" — non-sensitive).
  - **Not** Contributor or Owner anywhere.
- **GitHub deployer app** (`pritika-github-deployer`) has `Virtual Machine Contributor` scoped to
  the VM only. Nothing else.
- **Federated credentials** are per-repo + per-branch
  (`repo:pritika292/controlroom:ref:refs/heads/main`). A fork or feature branch cannot deploy.

### What's deliberately NOT in this v1 (so it can't be attacked)

- Google OAuth — no admin login means no auth surface.
- Sidecar container with Docker socket — no socket access anywhere on the VM means no
  privilege-escalation path from a ControlRoom compromise.
- Container restart endpoints — no destructive verbs reachable from HTTP.
- Log tail streaming — no internal-state leakage to the public.
- Cost dashboard — keeps Pritika's spend private.
- DB / Redis browsers — no schema/data introspection over HTTP.
- Audit log writes — there's nothing to audit because there are no admin actions.
- Session cookies — none at all. Stateless GETs only.
- Webhook receivers (other than the GitHub one) — single, narrow, HMAC-locked.

---

## Tech stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Runtime | Node 24 LTS via `mise` | Mirror shortlive `mise.toml`. |
| Server | Express 5 + TypeScript strict | Same as shortlive. |
| Frontend | React 18 + Vite + Tailwind | Mirror shortlive `build/` configs. |
| Live updates | **Server-Sent Events (SSE)** on `/api/stream` | Read-only push of status changes. Simpler than WebSocket; native `EventSource` in browser. |
| DB | PostgreSQL 16 (shared `pritika-postgres` container) | New database `controlroom`. Stores health pings + deploy events + cached GitHub data. |
| Cache | Redis 7 (shared `pritika-redis`) | Response cache + rate-limit buckets. |
| Tests | Vitest workspace (server: node env, client: jsdom) | Mirror shortlive `build/vitest.config.ts`. |
| Lint/format | ESLint flat config + Prettier | Mirror shortlive. |
| Pre-commit | `.pre-commit-config.yaml` with gitleaks | Mirror shortlive verbatim. |
| Security headers | `helmet` | Configured per Security Considerations. |
| Rate limiting | `express-rate-limit` + Redis store | Webhook + public API. |
| Deploy | OIDC → `az vm run-command` → `docker compose up -d` | Mirror shortlive. |
| Container budget | 384 MB | Matches shortlive. |

---

## CI/CD setup (the full shortlive stack)

Replicate every CI/CD piece shortlive has. Concretely:

### Workflows (under `.github/workflows/`)

1. **`ci.yml`** — sequential 4-job chain on push + PR: lint → typecheck → test (with Postgres +
   Redis services) → build. `actions/setup-node@<sha>` Node 24 with `cache: npm`.
   `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` at workflow level. `npm ci` only.

2. **`deploy.yml`** — on push to `main` after `ci.yml` passes:
   - `permissions: id-token: write, contents: read` for OIDC.
   - `azure/login@v2` with `client-id`, `tenant-id`, `subscription-id` from vars.
   - `az vm run-command invoke` inline shell that runs `bootstrap-vm.sh` + `docker compose pull && up -d --build`.
   - Final `curl -fsS http://localhost:3012/healthz`.

3. **`codeql.yml`** — CodeQL Advanced for JS/TS on PRs + weekly schedule.

4. **`dependency-review.yml`** — `actions/dependency-review-action` on PRs.

5. **`gitleaks.yml`** (or inline in `ci.yml`) — gitleaks scan on PRs as belt-and-braces to
   pre-commit.

### Repo settings (via `gh` CLI, one-time, committed to `scripts/repo-settings.sh`)

- Branch protection on `main`: require CI green; linear history; no force push.
- Default merge method: **squash**. Auto-delete head branches: **on**.
- Dependabot security updates: **on**. Secret scanning + push protection: **on**.

### Local dev loop

```sh
mise install
npm ci
docker compose -f docker-compose.local.yml up -d
cp .env.example .env                            # fill in personal GitHub PAT
npm run migrate
npm run dev                                     # http://localhost:3012
```

```sh
pre-commit install                              # one-time
```

### VM bootstrap

- `scripts/bootstrap-vm.sh` pulls the GitHub PAT from Key Vault via Managed Identity, writes
  `/opt/pritika/_infra/controlroom.env` with `chmod 600`, ensures the `pritika` docker network
  exists. Idempotent.

### Migration discipline

- New file per change: `migrations/NNN_short_description.sql`.
- Always additive.
- Runner records applied migrations in `_migrations`.
- Runs at container boot.

---

## Repo + infra bootstrap (do this first)

1. **Create the GitHub repo:**
   ```sh
   cd /Users/abdul/Library/Mobile\ Documents/com~apple~CloudDocs/Study/portfolio-projects/
   gh repo create pritika292/controlroom \
     --public \
     --description "Public status board for every portfolio project — health, deploys, commits" \
     --disable-wiki \
     --clone
   cd controlroom
   ```

2. **Seed the structure from shortlive:**
   ```sh
   cp -r ../shortlive/.github .
   cp -r ../shortlive/build .
   cp ../shortlive/.gitignore ../shortlive/.dockerignore ../shortlive/.editorconfig .
   cp ../shortlive/.pre-commit-config.yaml .
   cp ../shortlive/eslint.config.js ../shortlive/tsconfig.json ../shortlive/tsconfig.build.json .
   cp ../shortlive/Dockerfile ../shortlive/docker-compose.yml ../shortlive/docker-compose.local.yml .
   cp ../shortlive/mise.toml .
   cp -r ../shortlive/scripts .
   ```
   Edit every occurrence of `shortlive` → `controlroom`; retarget port `3010` → `3012`; retarget
   env file `/opt/pritika/_infra/shortlive.env` → `controlroom.env`.

3. **Update parent repo (`portfolio-control`):**
   - Edit `PLAN.md`: add `12. controlroom — port 3012`.
   - Create `docs/09-controlroom-deep-dive.md` (stub).
   - Update `docs/README.md` table.
   - Commit separately.

4. **Federated credential** (one-time on `pritika-github-deployer`):
   ```sh
   az ad app federated-credential create \
     --id <pritika-github-deployer-app-id> \
     --parameters '{
       "name": "controlroom-main",
       "issuer": "https://token.actions.githubusercontent.com",
       "subject": "repo:pritika292/controlroom:ref:refs/heads/main",
       "audiences": ["api://AzureADTokenExchange"]
     }'
   ```

5. **Key Vault secrets** (one-time):
   ```sh
   az keyvault secret set --vault-name pritika-portfolio-kv \
     --name controlroom-github-pat --value "<fine-grained PAT, read-only on pritika292/*>"
   az keyvault secret set --vault-name pritika-portfolio-kv \
     --name controlroom-github-webhook-secret --value "$(openssl rand -hex 32)"
   ```

6. **Database** (one-time, on shared Postgres):
   ```sh
   docker exec -it pritika-postgres createdb -U postgres controlroom
   ```

7. **GitHub Actions vars** on `pritika292/controlroom`:
   - `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RG`, `VM_NAME` —
     same as shortlive. **No secrets.**

8. **Repo settings hardening** (script `scripts/repo-settings.sh`).

---

## Feature inventory — 25 issues across 6 tiers (public-only scope)

Every row below becomes **one GitHub issue** with the title and body sketched. File all 25
issues *before* writing code, then PR them in clusters per the phases below.

**Issue body template:**

```
## Context
<one paragraph: why this matters in the ControlRoom story>

## Spec
<bullets: what to build, with exact route names, function names, file paths>

## Security
<any validation, rate-limit, secret-handling rule specific to this issue>

## Acceptance criteria
- [ ] <user-visible outcome>
- [ ] Tests written and passing
- [ ] Lint + typecheck clean
```

### Tier 1 — Foundations

| # | Issue title | Summary |
|---|-------------|---------|
| 1 | `Bootstrap repo: copy shortlive scaffold, retarget to controlroom` | Steps 1–2 of "Repo + infra bootstrap" above. AC: `npm run lint`, `npm run build`, `npm test` pass on an empty server returning `{ ok: true }` from `/healthz`. |
| 2 | `Config: Zod schema with prod guard for GITHUB_PAT + webhook secret` | `src/server/config.ts`; prod refuses to boot if `GITHUB_PAT` or `GITHUB_WEBHOOK_SECRET` are placeholder/empty. |
| 3 | `DB: migration runner + 001_health_pings + 002_deploys + 003_commits_cache` | Port `src/server/db/migrate.ts`. `health_pings(project, ts, status, latency_ms)`. `deploys(project, sha, actor, started_at, finished_at, status, run_url)`. `commits_cache(project, sha, author, message, ts)`. |
| 4 | `Security headers via helmet + GET-only middleware + disable X-Powered-By` | helmet per Security Considerations; reject non-GET on public routes (except `/webhooks/github`) with 405. |
| 5 | `CI: 4-job chain (lint, typecheck, test, build) + Postgres/Redis services` | Copy `.github/workflows/ci.yml`. Pinned action SHAs. |
| 6 | `CI: gitleaks + CodeQL + dependency-review + npm audit jobs` | All security scans wired into PR gating. |
| 7 | `Deploy: OIDC + az vm run-command + bootstrap-vm.sh + health check` | Copy `.github/workflows/deploy.yml`. Secrets read from Key Vault on VM. |
| 8 | `Pre-commit: gitleaks + standard hooks` | Copy `.pre-commit-config.yaml`. |
| 9 | `Frontend shell: Vite + React + Tailwind + topbar + theme toggle + routes /, /about` | Mirror shortlive structure. No `/login`, no `/admin`. |
| 10 | `Branch protection + Dependabot + secret scanning + push protection (scripts/repo-settings.sh)` | One-time hardening. |

### Tier 2 — Project registry + health

| # | Issue title | Summary |
|---|-------------|---------|
| 11 | `Project registry: src/server/projects.ts with shortlive + 10 planned slots` | Static array. Fields: `slug`, `name`, `status: 'live' | 'planned'`, `port`, `repo`, `liveUrl`, `eta`. Planned ones render greyed-out. |
| 12 | `Health poller: hit each live project's /healthz every 30s, store in health_pings` | `src/server/services/healthPoller.ts`. Timeouts isolated; one slow project doesn't block others. 24h rolling retention. |
| 13 | `GET /api/public/status — current health of every project` | Returns `[{ slug, name, status, lastPingAt, latencyMs }]`. Cached 5s. Never leaks internals. |
| 14 | `SSE /api/stream — push status changes to subscribed clients` | `EventSource`-compatible. Server emits on health-poller transitions. |

### Tier 3 — Public board UI

| # | Issue title | Summary |
|---|-------------|---------|
| 15 | `Public home: status board with green/red dots per project (greyed for planned)` | `src/client/pages/Home.tsx`. |
| 16 | `Uptime sparkline (last 24h) per project on public home` | Tiny SVG; data from `health_pings`. |
| 17 | `Live updates: client subscribes to /api/stream and animates dot transitions` | `useSSE` hook. Reconnect with backoff. |
| 18 | `Per-project detail page /p/:slug` | Bigger sparkline, last 100 pings table, latest commits, latest deploys. |

### Tier 4 — GitHub data (commits + deploys + CI)

| # | Issue title | Summary |
|---|-------------|---------|
| 19 | `GitHub sync worker: pull last 20 commits per project hourly, cache in commits_cache` | Server-side. Uses PAT from Key Vault. Respects rate limits. |
| 20 | `Last commit card per project on home (author, message, time)` | Reads from `commits_cache`. |
| 21 | `Deploy timeline per project: last 10 deploys (sha, author, duration, result)` | Server pulls workflow runs filtered by `name=deploy`. Cached 60s. |
| 22 | `Webhook receiver: /webhooks/github (HMAC-verified) writes to deploys table in real time` | Register webhooks via `scripts/register-webhooks.sh`. Reject bad sig. Rate-limited. |
| 23 | `Public stats strip on home: total deploys this week, total commits, projects live` | Aggregates from `deploys` + `commits_cache`. |

### Tier 5 — Incidents (file-based, no editor)

| # | Issue title | Summary |
|---|-------------|---------|
| 24 | `Incidents as markdown files under content/incidents/*.md (frontmatter: severity, project, opened, closed)` | No DB editor — Pritika commits markdown files. Loaded at boot + on file change. Render with `marked` + `DOMPurify`. Public banner on home if any open incident with `severity: high`. |

### Tier 6 — Polish

| # | Issue title | Summary |
|---|-------------|---------|
| 25 | `TLS via Caddy reverse proxy + auto Let's Encrypt + redirect HTTP→HTTPS + About page + docs/09 writeup` | Caddy in a new container on 80/443, proxies to 3012 (and other project ports). Enable HSTS in helmet. Write `/about` and finish `docs/09-controlroom-deep-dive.md` in portfolio-control. |

### Filing the issues

Script issue creation rather than file 25 by hand:

```sh
gh issue create \
  --title "Bootstrap repo: copy shortlive scaffold, retarget to controlroom" \
  --body "$(cat <<'EOF'
## Context
...
## Spec
...
## Security
...
## Acceptance criteria
- [ ] ...
EOF
)" \
  --label "tier-1"
```

Label each issue with its tier (`tier-1` … `tier-6`).

---

## Recommended implementation phases

| Phase | Issues | What's live after | Days |
|-------|--------|-------------------|------|
| **0 — Bootstrap** | 1–2, 5–8, 10 | Empty server boots locally + in CI + deploys to VM. Pre-commit blocks leaks. Repo hardened. | 1 |
| **1 — Shell + headers** | 3, 4, 9 | Frontend shell renders; security headers on every response. | 0.5 |
| **2 — Status board** | 11–18 | Public dashboard live at `http://135.232.183.50:3012/` with green/red dots, sparklines, live SSE updates, per-project pages. | 2 |
| **3 — GitHub data** | 19–23 | Commits, deploys, CI/CD timeline visible. Webhook updates land in real time. | 2 |
| **4 — Incidents** | 24 | Markdown-driven incident posts render on home. | 0.5 |
| **5 — TLS + polish** | 25 | HTTPS everywhere; about page; deep-dive doc. | 1 |

Total: ~7 working days. Each merged PR is demo-worthy on its own.

---

## Commit + PR conventions (mirror shortlive exactly)

- **Subject line**: imperative, ≤72 chars, no trailing period. Examples:
  - `Add health poller with per-project timeout isolation`
  - `Wire SSE stream from health transitions into client dot animation`
  - `Fix uptime sparkline when project has zero pings`
- **No AI fingerprints**: no "Generated with Claude Code", no Co-Authored-By Claude, no em-dashes
  in commit messages, no hyperbolic adjectives ("comprehensive", "robust", "powerful"). Read
  shortlive's git log for tone calibration.
- **Author identity**: `Pritika Priyadarshini <pritika98@gmail.com>` (verify with
  `git config user.email` before first commit).
- **PR titles**: `Tier N: short description (closes #X, #Y)`. Body has Summary (1–3 bullets) +
  Test plan (checkbox list).
- **Branch names**: short, kebab-case. `health-poller`, `sse-stream`.
- **Merge style**: `gh pr merge --squash --delete-branch` after CI green.

---

## Critical files (final list — to be created)

```
controlroom/
├── .github/
│   ├── workflows/{ci,deploy,codeql,dependency-review,gitleaks}.yml
│   ├── dependabot.yml
│   └── pull_request_template.md
├── .pre-commit-config.yaml
├── .gitleaks.toml
├── Dockerfile
├── docker-compose.yml
├── docker-compose.local.yml
├── build/{vite,vitest,tailwind,postcss}.config.*
├── eslint.config.js
├── tsconfig.json, tsconfig.build.json
├── mise.toml
├── package.json
├── README.md
├── CLAUDE.md
├── .env.example
├── content/
│   └── incidents/                       # markdown files committed by Pritika
├── migrations/
│   ├── 001_health_pings.sql
│   ├── 002_deploys.sql
│   ├── 003_commits_cache.sql
│   └── ...
├── scripts/
│   ├── bootstrap-vm.sh
│   ├── file-all-issues.sh
│   ├── register-webhooks.sh
│   └── repo-settings.sh
└── src/
    ├── server/
    │   ├── server.ts
    │   ├── config.ts
    │   ├── db/{migrate,pool}.ts
    │   ├── middleware/{securityHeaders,getOnly,rateLimit}.ts
    │   ├── services/{healthPoller,githubSync,keyVault,sseHub,incidentsLoader}.ts
    │   ├── routes/{publicStatus,publicProject,sseStream,webhooksGithub,healthz}.ts
    │   └── projects.ts
    └── client/
        ├── main.tsx, App.tsx
        ├── components/{TopBar,ThemeToggle,ProjectCard,Sparkline,StatusDot,IncidentBanner,DeployRow,CommitCard}.tsx
        ├── hooks/{useSSE,useStatus}.ts
        └── pages/
            ├── Home.tsx
            ├── About.tsx
            └── Project.tsx
```

Parent repo (`portfolio-control`) also gets touched:

```
PProjects/
├── PLAN.md                                    # add controlroom on port 3012
└── docs/
    ├── README.md                              # add row for doc 09
    └── 09-controlroom-deep-dive.md            # written at end of Tier 6
```

---

## Verification — how to know ControlRoom works end-to-end

### Local

```sh
docker compose -f docker-compose.local.yml up -d
npm install
npm run migrate
npm run dev                                     # http://localhost:3012
```

- [ ] `curl http://localhost:3012/healthz` returns `{ ok: true }`
- [ ] Visit `http://localhost:3012/` — public board shows shortlive status
- [ ] Stop shortlive container; ControlRoom flips its dot to red within 30s; SSE pushes the
      change live without page refresh
- [ ] Per-project page `/p/shortlive` shows last 100 pings + commits + deploys
- [ ] Hammer `/api/public/status` 100×/min from one IP → rate-limited after 60
- [ ] POST anything to a public route → 405

### CI

- [ ] First push to `main` triggers all CI jobs; they pass green
- [ ] Deploy workflow runs after CI; OIDC succeeds; `az vm run-command` succeeds
- [ ] `curl http://135.232.183.50:3012/healthz` returns `{ ok: true }`
- [ ] CodeQL, gitleaks, `npm audit --omit=dev` all clean

### Prod

- [ ] Public board reachable at `http://135.232.183.50:3012/`
- [ ] Real shortlive deploy triggers a `deploys` row via webhook within seconds
- [ ] Commit a markdown file under `content/incidents/2026-05-foo.md` with
      `severity: high` + `opened: 2026-05-22` → next push to main shows incident banner on home

### Security smoke test (before announcing externally)

- [ ] `gitleaks detect --no-banner` clean
- [ ] `grep -rIE "AIza|sk-[A-Za-z0-9]{20,}|ghp_|github_pat_|xox[baprs]-" .` clean
- [ ] `gh secret list` shows zero secrets in the controlroom repo
- [ ] Helmet headers present on every response
- [ ] `POST /api/public/status` returns 405
- [ ] `POST /webhooks/github` without valid HMAC returns 401
- [ ] `nmap -p- 135.232.183.50` shows only expected ports open
- [ ] Azure RBAC: VM identity has only Reader on RG + Key Vault Secrets User on the vault
- [ ] Federated credential subject exact: `repo:pritika292/controlroom:ref:refs/heads/main`

---

## What the executing agent should do first (literal next-action checklist)

1. Read this entire plan file.
2. Read `shortlive/README.md`, `shortlive/CLAUDE.md`, and every file listed under "Specific
   shortlive files to mirror".
3. Read `docs/README.md`, `docs/02-iam-security.md`, `docs/03-cicd-oidc.md`,
   `docs/05-deployment-strategy.md`, `docs/06-security-pre-commit.md` in portfolio-control.
4. Run the **Repo + infra bootstrap** section's commands in order.
5. Write `scripts/file-all-issues.sh` and run it to file all 25 issues with bodies expanded from
   the table above (including the **Security** section in each body).
6. Start Phase 0 — get an empty `/healthz` server passing CI and deploying to the VM. Don't move
   to Phase 1 until that's green end-to-end.
7. For each subsequent phase, open one branch per cluster of related issues, ship the PR, merge,
   verify in prod, then move on.
8. After Tier 6 ships, update `docs/09-controlroom-deep-dive.md` in portfolio-control with the
   final architecture writeup (mirror the depth of `docs/08-shortlive-deep-dive.md`).

---

## Out of scope (do NOT do these in this project)

- **Any admin login or authenticated UI.** The whole point of this scope is "no auth surface."
- **Any write endpoint beyond `/webhooks/github`.** No "submit feedback" forms, no comment system.
- **Sidecar containers, Docker socket access, container restart buttons.** Removed for security.
- **Log tail streaming, DB browser, Redis browser, cost dashboard.** Removed for security + scope.
- **WebSocket bidirectional channels.** SSE is sufficient (read-only push).
- **Cross-cloud support.** Azure-only.
- **Self-service onboarding for new projects.** Adding a project = editing
  `src/server/projects.ts` and redeploying. Fine for a portfolio of 11.
- **Storing any secret outside Azure Key Vault.**
