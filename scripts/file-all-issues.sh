#!/usr/bin/env bash
#
# Files all 25 ControlRoom GitHub issues across tiers 1-6.
#
# Idempotent: skips any issue whose title already exists on the repo.
# Creates the tier-1..tier-6 labels if they don't exist.
#
# Usage: scripts/file-all-issues.sh
#
# Requires: gh CLI authenticated as pritika292 with `repo` scope.

set -euo pipefail

REPO="pritika292/controlroom"

if ! gh repo view "$REPO" >/dev/null 2>&1; then
  echo "error: cannot access $REPO via gh -- check auth" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Labels
# ---------------------------------------------------------------------------

ensure_label() {
  local name="$1"
  local color="$2"
  if ! gh label list -R "$REPO" --json name -q '.[].name' | grep -qx "$name"; then
    echo "creating label: $name"
    gh label create "$name" -R "$REPO" --color "$color" --description "ControlRoom $name" >/dev/null
  fi
}

ensure_label "tier-1" "0E8A16"
ensure_label "tier-2" "1D76DB"
ensure_label "tier-3" "5319E7"
ensure_label "tier-4" "FBCA04"
ensure_label "tier-5" "D93F0B"
ensure_label "tier-6" "B60205"

# ---------------------------------------------------------------------------
# Issue helper
#
# Reads the body from stdin so the heredoc can safely contain apostrophes,
# backticks, dollars, etc. without bash parser confusion.
# ---------------------------------------------------------------------------

EXISTING_TITLES=$(gh issue list -R "$REPO" --state all --limit 200 --json title -q '.[].title')

file_issue() {
  local title="$1"
  local label="$2"
  local body
  body=$(cat)

  if grep -Fxq "$title" <<<"$EXISTING_TITLES"; then
    echo "skip (exists): $title"
    return 0
  fi

  echo "create: $title"
  gh issue create -R "$REPO" \
    --title "$title" \
    --label "$label" \
    --body "$body" >/dev/null
}

# ---------------------------------------------------------------------------
# TIER 1 -- Foundations
# ---------------------------------------------------------------------------

file_issue \
  "Bootstrap repo: copy shortlive scaffold, retarget to controlroom" \
  "tier-1" <<'EOF'
## Context

First commit lands the toolchain identical to shortlive but pointed at the new ports and paths. Until this is done, no other PR can pass CI. Mirror shortlive exactly -- same Node 24, same Express + TypeScript strict, same Vitest workspace, same Dockerfile shape.

## Spec

Copy each of these from `../shortlive/` and adapt:

- `.github/workflows/{ci,deploy,codeql,dependency-review,gitleaks}.yml`
- `.github/dependabot.yml`, `.github/pull_request_template.md`
- `Dockerfile`, `docker-compose.yml`, `docker-compose.local.yml`
- `.pre-commit-config.yaml`, `.gitleaks.toml`
- `eslint.config.js`, `tsconfig.json`, `tsconfig.build.json`
- `build/{vite,vitest,tailwind,postcss}.config.*` (Vitest workspace splits server=node / client=jsdom)
- `mise.toml` pinned to `node = "24"`
- `package.json` with scripts: `dev`, `build`, `start`, `migrate`, `test`, `test:watch`, `lint`, `lint:fix`, `format`, `typecheck`. Engines `"node": ">=24"`. Inlined Prettier config.
- `.env.example`, `.editorconfig`, `.dockerignore`, `.gitignore`, `.nvmrc`

Then:

- Find-replace every `shortlive` -> `controlroom`.
- Retarget port `3010` -> `3012` in `.env.example`, `docker-compose.yml`, `docker-compose.local.yml`, Vite proxy targets, Dockerfile EXPOSE, healthcheck stanzas.
- Retarget env file path `/opt/pritika/_infra/shortlive.env` -> `/opt/pritika/_infra/controlroom.env`.
- Add minimal `src/server/index.ts` + `src/server/app.ts` returning `{ ok: true }` from `GET /health`.
- Add minimal `src/client/main.tsx` and `src/client/App.tsx` so Vite builds.

## Security

- Re-run `gitleaks detect --no-banner --redact` on the staged tree before committing.
- Do NOT copy any `.env`; only `.env.example`.
- Verify no shortlive secrets, paths, or hostnames leaked into copied files (`grep -ri shortlive .` should return zero hits after rename).

## Acceptance criteria

- [ ] `npm ci` succeeds against a fresh `package-lock.json`
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build` produces `dist/server/index.js` and `dist/client/`
- [ ] `npm test` exits 0 (no tests yet is fine)
- [ ] `npm run dev` boots and `curl http://localhost:3012/health` returns `{"ok":true}`
- [ ] `pre-commit run --all-files` is green
- [ ] CI passes on the PR for this issue (lint, typecheck, test, build all green)
EOF

file_issue \
  "Config: Zod schema with prod guards for GITHUB_PAT, webhook secret, REDIS_URL" \
  "tier-1" <<'EOF'
## Context

A blank or placeholder PAT in prod is a silent security hole; a wrong Redis DB number causes silent cross-project data collisions in the shared Redis. Mirror shortlive's `IP_HASH_PEPPER` prod-guard pattern so the container refuses to boot rather than running with a broken integration.

## Spec

`src/server/config.ts` exports `config` (parsed Zod result) and a `Config` type.

Schema fields:

- `NODE_ENV`: enum `['development','test','production']`
- `PORT`: number, default 3012
- `DATABASE_URL`: URL string
- `REDIS_URL`: URL string
- `GITHUB_PAT`: non-empty string
- `GITHUB_WEBHOOK_SECRET`: non-empty string
- `LOG_LEVEL`: enum `['debug','info','warn','error']`, default `info`

Production-only refines (no-op in dev/test):

- `GITHUB_PAT` must match `^(github_pat_[A-Za-z0-9_]{40,}|ghp_[A-Za-z0-9]{36})$` AND not equal `replace-me`.
- `GITHUB_WEBHOOK_SECRET` length >= 32 AND not equal `replace-me`.
- `REDIS_URL` must end with `/12` (controlroom's logical DB; collisions with other projects in the shared Redis are silent and miserable to debug).

On parse failure: print the Zod error tree (with `redact()` applied) and `process.exit(1)`.

Load via `import "dotenv/config";` at the top of `src/server/index.ts`.

Add a `redact(value: unknown): unknown` helper that emits `***` for any key whose name ends with `PAT`, `SECRET`, `TOKEN`, `KEY`, or `PASSWORD` (case-insensitive).

## Security

- Never log the parsed config object verbatim -- always through `redact()`.
- Boot crash > silent insecurity. Test that placeholder values exit 1 in prod.
- `redact()` must handle nested objects and arrays.

## Acceptance criteria

- [ ] Prod boot with `GITHUB_PAT=replace-me` exits non-zero within 100ms
- [ ] Prod boot with valid values starts cleanly
- [ ] Dev boot with placeholders starts but logs a warning
- [ ] `tests/config.test.ts` covers: missing var (fail), placeholder in prod (fail), valid prod values (pass), short webhook secret (fail), wrong Redis DB number (fail)
- [ ] `redact()` covers nested keys
- [ ] Lint + typecheck clean
EOF

file_issue \
  "DB: migration runner + 001_health_pings + 002_deploys + 003_commits_cache" \
  "tier-1" <<'EOF'
## Context

Every worker (health poller, GitHub sync, webhook receiver) writes to these three tables. Until the migration runner + schemas land, nothing else can. Mirror shortlive's runner verbatim -- same `_migrations` ledger, same transaction-per-file behaviour.

## Spec

- Port `src/server/db/migrate.ts` from shortlive. Reads `migrations/*.sql` in lexicographic order, records applied filenames in `_migrations(filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())`, skips already-applied files. Each file runs inside a transaction; failure rolls back and exits non-zero.
- `src/server/db/pool.ts`: singleton `pg.Pool` from `config.DATABASE_URL`. Max 5 connections.
- `npm run migrate` -> `tsx src/server/db/migrate.ts`.
- Dockerfile CMD: `npm run migrate && node dist/server/index.js` (idempotent runner, safe to run on every container boot).

Migrations (always additive, never edit after merge):

**`migrations/001_health_pings.sql`**

```sql
CREATE TABLE health_pings (
  project    TEXT        NOT NULL,
  ts         TIMESTAMPTZ NOT NULL DEFAULT now(),
  status     TEXT        NOT NULL CHECK (status IN ('up','down')),
  latency_ms INTEGER,
  PRIMARY KEY (project, ts)
);
CREATE INDEX health_pings_recent ON health_pings (project, ts DESC);
```

**`migrations/002_deploys.sql`**

```sql
CREATE TABLE deploys (
  project     TEXT        NOT NULL,
  sha         TEXT        NOT NULL,
  actor       TEXT,
  started_at  TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  status      TEXT        NOT NULL CHECK (status IN ('queued','running','success','failure','cancelled')),
  run_url     TEXT,
  PRIMARY KEY (project, sha, started_at)
);
CREATE INDEX deploys_by_project ON deploys (project, started_at DESC);
```

**`migrations/003_commits_cache.sql`**

```sql
CREATE TABLE commits_cache (
  project    TEXT        NOT NULL,
  sha        TEXT        NOT NULL,
  author     TEXT,
  message    TEXT,
  ts         TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project, sha)
);
CREATE INDEX commits_cache_recent ON commits_cache (project, ts DESC);
```

## Security

- All queries (here and in workers) MUST be parameterised via `pg`'s `$1, $2` syntax. No string interpolation anywhere.
- Migrations never accept user input -- they are static SQL files only.
- Runner refuses to run if `DATABASE_URL` is missing.

## Acceptance criteria

- [ ] `npm run migrate` against an empty DB creates all three tables, indexes, and `_migrations`
- [ ] Re-running is a no-op
- [ ] CI's test job runs `npm run migrate` before tests
- [ ] `tests/migrate.test.ts` runs the runner against the CI Postgres service and asserts table presence + idempotency
- [ ] Lint + typecheck clean
EOF

file_issue \
  "Security headers via helmet + GET-only middleware + disable X-Powered-By" \
  "tier-1" <<'EOF'
## Context

Read-only public board. Strict headers everywhere. Anything reachable must respond `GET`-only. The webhook endpoint is the single exception (the only `POST`).

## Spec

`src/server/middleware/securityHeaders.ts` exports a configured `helmet()` instance:

- CSP: `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: https://avatars.githubusercontent.com`, `connect-src 'self'`, `font-src 'self'`, `object-src 'none'`, `base-uri 'self'`
- `frameguard: { action: 'deny' }`
- `referrerPolicy: { policy: 'no-referrer' }`
- `crossOriginEmbedderPolicy: false` (Tailwind compat)
- `permittedCrossDomainPolicies: { permittedPolicies: 'none' }`
- HSTS: off until Tier 6 (Caddy lands), with a comment in the file explaining when to enable

`src/server/middleware/getOnly.ts`:

- Reject any method other than `GET`, `HEAD`, `OPTIONS` with `405 Method Not Allowed` and `Allow: GET, HEAD` header.
- Body: `{"error":"method not allowed"}` (no handler name leaked).
- Bypass when `req.path === '/webhooks/github'`.

`app.disable('x-powered-by')` at boot.

## Security

- CSP must be tested against the actual built Vite bundle -- no inline scripts allowed. Use nonces if necessary.
- 405 response body must NOT include the handler/router name.
- Verify with `curl -I` that no `X-Powered-By` header is emitted.

## Acceptance criteria

- [ ] `curl -I http://localhost:3012/` shows `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, CSP header, no `X-Powered-By`
- [ ] `curl -X POST http://localhost:3012/api/public/status` returns 405 with the documented JSON body
- [ ] `curl -X POST http://localhost:3012/webhooks/github` does NOT 405 (passes to the handler, which then 400s on missing signature)
- [ ] Vitest covers all three
- [ ] Lint + typecheck clean
EOF

file_issue \
  "CI: 4-job chain (lint, typecheck, test, build) + Postgres/Redis services + inlined npm audit" \
  "tier-1" <<'EOF'
## Context

Branch protection requires a green CI. Without this workflow, nothing merges. Mirror shortlive's structure exactly; add `npm audit` as a step inside the `lint` job (resolved in PLAN.md `[opus]` comment -- keep it inline, no separate workflow file).

## Spec

`.github/workflows/ci.yml` runs on `push` (main) and `pull_request`. Four sequential jobs (fail-fast):

1. **lint**: `npm ci` -> `npm run lint` -> `npm run format:check` -> `npm audit --omit=dev --audit-level=high`
2. **typecheck**: `npm ci` -> `npm run typecheck`
3. **test**: services `postgres:16-alpine` + `redis:7-alpine`, env `DATABASE_URL=postgres://controlroom:testpass@localhost:5432/controlroom_test`, `REDIS_URL=redis://localhost:6379/12`, `GITHUB_PAT=github_pat_ci_dummy_padded_for_regex_xxxxxxxxxxxxxxxxxxxxxxx`, `GITHUB_WEBHOOK_SECRET=ci-test-webhook-secret-32-chars-min!!`, `NODE_ENV=test`; steps `npm ci` -> `npm run migrate` -> `npm test`
4. **build**: `npm ci` -> `npm run build` -> upload `dist/` as an artifact

Workflow-level:

- `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` in `env:`
- `actions/setup-node@<sha>` pinned, with `cache: npm`
- All actions pinned to commit SHAs with the human-readable tag in a trailing comment
- Concurrency group `ci-${{ github.ref }}` with cancel-in-progress for PRs

## Security

- No secrets used. Only repo variables (none needed for CI).
- All actions pinned to SHA.
- `npm audit` step must fail the job on any `high`+ severity advisory in prod deps.

## Acceptance criteria

- [ ] Opening a PR triggers all four jobs sequentially
- [ ] All four pass green on the bootstrap repo
- [ ] Postgres + Redis services start and the test job connects
- [ ] An intentionally vulnerable dep (e.g., installing `event-stream@3.3.6`) is rejected by the audit step
- [ ] Action versions pinned to SHA throughout
EOF

file_issue \
  "CI: gitleaks + CodeQL + dependency-review workflows" \
  "tier-1" <<'EOF'
## Context

Pre-commit catches ~90% of leaks. CI must catch the remaining 10% -- `--no-verify` commits, forked-PR contributors, anyone bypassing local hooks. SAST and supply-chain checking layered on top.

## Spec

- `.github/workflows/gitleaks.yml`: `gitleaks/gitleaks-action@<sha>` on PRs. Fail on findings. Post a sticky PR comment with the diff fingerprint.
- `.github/workflows/codeql.yml`: CodeQL Advanced for `javascript-typescript`. Triggers: `pull_request` (main), `push` (main), `schedule: cron '0 7 * * 1'` (Monday 0700 UTC). Upload results to the Security tab.
- `.github/workflows/dependency-review.yml`: `actions/dependency-review-action@<sha>` on PRs. Fail on `high`+ severity. License allowlist matching shortlive (MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, CC0-1.0).

Each workflow:

- Top-level `permissions: contents: read` (and `security-events: write` only where CodeQL needs it, `pull-requests: write` only for gitleaks sticky comments).
- All actions pinned to SHAs with tag comments.

## Security

- Each workflow's `permissions:` block is least-privilege.
- Gitleaks must run on the diff, not just the latest commit (catches `--force-push` cleanup attempts).

## Acceptance criteria

- [ ] PR introducing a fake AWS key is rejected by gitleaks
- [ ] PR introducing a high-severity dep is rejected by dependency-review
- [ ] CodeQL appears on the Security tab after first run
- [ ] All actions pinned to SHA
EOF

file_issue \
  "Deploy: OIDC + az vm run-command + bootstrap-vm.sh + health check" \
  "tier-1" <<'EOF'
## Context

Every push to main must auto-deploy via OIDC. No secrets stored in GitHub Actions -- only non-sensitive repo variables. Secrets live in Azure Key Vault and are pulled to the VM at deploy time via Managed Identity.

## Spec

`.github/workflows/deploy.yml`:

- Trigger: `workflow_run` on `ci.yml` completion, condition `conclusion == 'success' && head_branch == 'main'`. Also `workflow_dispatch` for manual re-runs.
- Top-level `permissions: id-token: write, contents: read` for OIDC.
- Concurrency: `group: deploy-controlroom`, `cancel-in-progress: false` (serial deploys).
- Steps: `azure/login@<sha>` (`client-id: ${{ vars.AZURE_DEPLOY_CLIENT_ID }}`, `tenant-id: ${{ vars.AZURE_TENANT_ID }}`, `subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}`) -> `az vm run-command invoke -g ${{ vars.AZURE_DEPLOY_RG }} -n ${{ vars.AZURE_DEPLOY_VM_NAME }} --command-id RunShellScript --scripts '/opt/pritika/deploy.sh controlroom'` -> final health check `curl -fsS --max-time 10 --retry 6 --retry-delay 10 http://localhost:3012/health` (run via a second `az vm run-command invoke`).

`scripts/bootstrap-vm.sh` (called by `/opt/pritika/deploy.sh controlroom` before `docker compose up`):

- Verifies `az` CLI is authenticated via the VM's system-assigned managed identity (`az login --identity`).
- Pulls `controlroom-github-pat` and `controlroom-github-webhook-secret` from Key Vault `pritika-portfolio-kv` via `az keyvault secret show --query value -o tsv`. Stores into local shell variables only.
- Reads shared `POSTGRES_PASSWORD` and `REDIS_PASSWORD` from `/opt/pritika/_infra/.env`.
- Writes `/opt/pritika/_infra/controlroom.env` via `install -m 600 /dev/null` then a heredoc redirected to the file. Idempotent: a re-run produces a byte-identical file when secrets have not rotated.
- Ensures the external `pritika` docker network exists (`docker network inspect pritika >/dev/null 2>&1 || docker network create pritika`).

Repo variables required (no secrets):

- `AZURE_DEPLOY_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_DEPLOY_RG`
- `AZURE_DEPLOY_VM_NAME`

## Security

- Federated credential subject MUST be exact: `repo:pritika292/controlroom:ref:refs/heads/main`. Feature branches and forks cannot deploy.
- `bootstrap-vm.sh` must NEVER `echo` a secret. Use `printf '%s\n' "$secret" >> file` patterns and shell variables, never CLI args (visible in process listings + Azure activity logs).
- `controlroom.env` written with `chmod 600`, owned by root.
- No secret passed as a `--scripts` argument to `az vm run-command invoke` (would appear in Azure activity logs).
- `gh secret list -R pritika292/controlroom` must remain empty.

## Acceptance criteria

- [ ] Push to main triggers deploy.yml after ci.yml passes
- [ ] `azure/login@v2` exchanges the OIDC token successfully (visible in Azure activity logs)
- [ ] `az vm run-command` exits 0
- [ ] Final `curl http://localhost:3012/health` returns `{"ok":true}` from the VM
- [ ] `bootstrap-vm.sh` is byte-stable when re-run with unchanged secrets
- [ ] `gh secret list -R pritika292/controlroom` is empty
EOF

file_issue \
  "Pre-commit: gitleaks + standard hooks" \
  "tier-1" <<'EOF'
## Context

First line of defence against secret leaks. Every contributor (Pritika + future agents) must run `pre-commit install` before their first commit. CI re-runs gitleaks as a backstop for `--no-verify` bypass.

## Spec

Copy `.pre-commit-config.yaml` from shortlive verbatim. Hooks (all pinned to SHA, no `rev: master`):

- `gitleaks` v8.21.0
- `detect-private-key`
- `check-added-large-files` (max 500 KB)
- `check-merge-conflict`
- `check-yaml`, `check-json`
- `end-of-file-fixer`, `trailing-whitespace`, `mixed-line-ending`
- `shellcheck` on `*.sh`

Copy `.gitleaks.toml` from shortlive (if present) -- adapt project name in the config header only.

Add to `README.md` Quickstart:

```sh
pre-commit install   # one-time
```

## Security

- All hooks pinned to SHA or specific version, never `master`/`main`.
- `--no-verify` is a known escape hatch; CI's `gitleaks.yml` covers it.

## Acceptance criteria

- [ ] `pre-commit install` succeeds in a fresh checkout
- [ ] `pre-commit run --all-files` is green on the bootstrap commit
- [ ] Attempting to commit a file containing `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` is blocked
- [ ] Attempting to commit a 1 MB binary is blocked by `check-added-large-files`
EOF

file_issue \
  "Frontend shell: Vite + React + Tailwind + topbar + theme toggle + routes /, /about, /p/:slug" \
  "tier-1" <<'EOF'
## Context

The SPA shell must render with strict CSP and security headers intact. No `/login`, no `/admin`. The shell is what Tiers 2-5 hang their content off.

## Spec

- `src/client/main.tsx`: ReactDOM root mount on `#root`.
- `src/client/App.tsx`: `BrowserRouter` with routes `/` -> `Home`, `/about` -> `About`, `/p/:slug` -> `Project` (placeholder stub until #18), `*` -> 404 component.
- `src/client/components/TopBar.tsx`: brand text, nav links (Home, About), theme toggle button.
- `src/client/components/ThemeToggle.tsx`: toggles `dark` class on `<html>`, persists to `localStorage` under key `controlroom:theme`. Default: matches `prefers-color-scheme`.
- `src/client/pages/Home.tsx`, `src/client/pages/About.tsx`: stub content (full content arrives in later tiers).
- Tailwind per `build/tailwind.config.ts` from shortlive. Dark mode `class`-based.
- Vite dev proxy: `/api`, `/webhooks`, `/health` -> `http://localhost:3012`.
- Production: Express serves `dist/client/` via `express.static` mounted last (after API routes).

## Security

- No third-party CDN scripts or stylesheets. CSP `script-src 'self'` must pass.
- No raw HTML rendered from any data source.
- No external image URLs (avatars come later in #20 with an explicit CSP allowlist).
- React Router with `BrowserRouter` only -- no history-mutation libraries.

## Acceptance criteria

- [ ] `npm run dev` renders `/` with the topbar at `http://localhost:3012/`
- [ ] Theme toggle persists across reloads
- [ ] `npm run build` emits a static `dist/client/` consumed by Express
- [ ] No CSP violations in browser devtools
- [ ] Mobile layout viable at 320px width
EOF

file_issue \
  "Branch protection + Dependabot + secret scanning + push protection (scripts/repo-settings.sh)" \
  "tier-1" <<'EOF'
## Context

One-time hardening so the repo's policy survives across agent sessions. Run after the bootstrap PR merges so CI status check names exist.

## Spec

`scripts/repo-settings.sh` -- idempotent shell script using `gh api`. Re-runnable without error.

- **Branch protection on `main`**:
  - Required status checks: `lint`, `typecheck`, `test`, `build`, `gitleaks`, `CodeQL`, `dependency-review` (names match the workflow job names)
  - `strict: true` (must be up to date with main before merge)
  - `enforce_admins: false` (Pritika can override in emergency)
  - `required_linear_history: true`
  - `allow_force_pushes: false`
  - `allow_deletions: false`
  - `required_pull_request_reviews: { required_approving_review_count: 0 }` (solo project -- gate is CI, not human review)
- **Merge methods**: allow squash only; disable merge commits + rebase merges. `delete_branch_on_merge: true`.
- **Dependabot security updates**: on. Vulnerability alerts: on.
- **Secret scanning**: on. Push protection: on.

## Security

- Script must be safe to re-run (idempotent).
- After running, `gh secret list -R pritika292/controlroom` must return zero.
- After running, attempting to push a file containing a real-looking PAT to a feature branch should be blocked by push protection.

## Acceptance criteria

- [ ] `scripts/repo-settings.sh` runs cleanly on a fresh repo and a second time (idempotent)
- [ ] Branch protection visible in Settings -> Branches with the expected checks
- [ ] A test PR cannot be merged until all required checks pass
- [ ] Push protection blocks a fake PAT pushed to a feature branch
EOF

# ---------------------------------------------------------------------------
# TIER 2 -- Project registry + health
# ---------------------------------------------------------------------------

file_issue \
  "Project registry: src/server/projects.ts with shortlive + 10 planned slots" \
  "tier-2" <<'EOF'
## Context

Static, typed list of projects ControlRoom monitors. The health poller, GitHub sync worker, public status API, and frontend all read from this single source of truth. Adding a new project = editing this file and redeploying.

## Spec

`src/server/projects.ts` exports:

```ts
export type ProjectStatus = 'live' | 'planned';
export type Project = {
  slug: string;
  name: string;
  status: ProjectStatus;
  port: number | null;
  repo: string;
  liveUrl: string | null;
  eta: string | null;  // ISO date for planned, null for live
};
export const projects: readonly Project[] = [...];
export function getProject(slug: string): Project | undefined;
export function getLiveProjects(): readonly Project[];
```

Entries:

| slug | name | status | port | repo | liveUrl | eta |
|---|---|---|---|---|---|---|
| shortlive | Shortlive | live | 3010 | pritika292/shortlive | http://135.232.183.50:3010 | null |
| edgeflag | EdgeFlag | planned | 3001 | pritika292/edgeflag | null | (from PProjects PLAN.md) |
| canvasync | CanvaSync | planned | 3002 | pritika292/canvasync | null | (from PProjects PLAN.md) |
| recall | Recall | planned | 3003 | pritika292/recall | null | (from PProjects PLAN.md) |
| pulseboard | PulseBoard | planned | 3004 | pritika292/pulseboard | null | (from PProjects PLAN.md) |
| liveauction | LiveAuction | planned | 3005 | pritika292/liveauction | null | (from PProjects PLAN.md) |
| hookrelay | HookRelay | planned | 3006 | pritika292/hookrelay | null | (from PProjects PLAN.md) |
| prbot | PRBot | planned | 3007 | pritika292/prbot | null | (from PProjects PLAN.md) |
| flowforge | FlowForge | planned | 3008 | pritika292/flowforge | null | (from PProjects PLAN.md) |
| mcphub | MCPHub | planned | 3009 | pritika292/mcphub | null | (from PProjects PLAN.md) |
| pitchpage | PitchPage | planned | 3011 | pritika292/pitchpage | null | (from PProjects PLAN.md) |

Ports come from `docs/05-deployment-strategy.md`'s service matrix. Cross-reference before committing -- typos here cascade everywhere.

## Security

- Internal-only module. The registry is exposed to the public API only via curated payloads in #13 / #18 (never the raw object).
- `liveUrl` is hardcoded; no URLs ever constructed from user input.
- `getProject(slug)` rejects unknown slugs by returning `undefined`; callers must 404.

## Acceptance criteria

- [ ] 11 entries (1 live + 10 planned)
- [ ] `getLiveProjects()` returns 1 entry
- [ ] `tests/projects.test.ts` covers helpers + asserts unique slugs and ports
- [ ] Slugs match the `^[a-z0-9-]{1,32}$` pattern used in API routes
- [ ] Lint + typecheck clean
EOF

file_issue \
  "Health poller: hit each live project's /health every 30s, store in health_pings" \
  "tier-2" <<'EOF'
## Context

Internal worker that produces the dot colour for every live project. Must isolate timeouts so one slow project doesn't block others. 24h retention rolling -- older rows trimmed daily.

## Spec

`src/server/services/healthPoller.ts` exports `startHealthPoller()` and `stopHealthPoller()`.

Loop body (every 30s):

- For each `getLiveProjects()`, in parallel via `Promise.allSettled`:
  - `fetch(project.liveUrl + '/health', { signal: AbortSignal.timeout(5000) })`
  - On 2xx: `status='up'`, `latency_ms = Math.round(performance.now() - start)`
  - On timeout/non-2xx/network error: `status='down'`, `latency_ms = null`
  - `INSERT INTO health_pings (project, status, latency_ms) VALUES ($1, $2, $3)` (parameterised)
- If the previous-most-recent ping for that project had a different `status`, emit a typed event via the SSE hub (#14): `{ type: 'status-change', slug, from, to, at }`.

Retention sweeper: once every hour, `DELETE FROM health_pings WHERE ts < now() - INTERVAL '24 hours'` inside a transaction.

Skip starting when `NODE_ENV === 'test'`. Wire to `src/server/index.ts` after migrations succeed.

`stopHealthPoller()` cancels the timer and awaits the in-flight cycle so test teardown is clean.

## Security

- 5s hard timeout per fetch -- no project can stall the loop.
- `liveUrl` comes from the static registry -- never from user input.
- Logger emits status code + millisecond latency only, never response bodies.
- No exception bubbles out of the loop body (per-project try/catch).

## Acceptance criteria

- [ ] One slow project (5s timeout) does not delay others past one cycle
- [ ] `tests/healthPoller.test.ts` with a mocked `fetch` covers up / down / timeout / transition paths
- [ ] Manual test: stop shortlive container -> next ping within 30s records `down` + emits an SSE event
- [ ] Retention sweeper trims rows older than 24h
- [ ] Lint + typecheck clean
EOF

file_issue \
  "GET /api/public/status -- current health of every project (cached 5s)" \
  "tier-2" <<'EOF'
## Context

The home page hits this endpoint on every load. Must be cacheable (5s Redis) and never reveal internals like ports or repo names.

## Spec

`src/server/routes/publicStatus.ts` exports an Express router mounted at `/api/public`.

`GET /api/public/status` returns:

```json
[
  {
    "slug": "shortlive",
    "name": "Shortlive",
    "status": "live",
    "currentHealth": "up",
    "lastPingAt": "2026-05-22T10:34:01Z",
    "latencyMs": 87,
    "eta": null
  },
  {
    "slug": "edgeflag",
    "name": "EdgeFlag",
    "status": "planned",
    "currentHealth": null,
    "lastPingAt": null,
    "latencyMs": null,
    "eta": "2026-07-01"
  }
]
```

Implementation:

- Reads from `health_pings` filtered to the latest ping per project via `SELECT DISTINCT ON (project) project, ts, status, latency_ms FROM health_pings ORDER BY project, ts DESC`.
- Planned projects emit `currentHealth: null`.
- Cache payload in Redis under `controlroom:status:current` with `EX 5`.
- Set `Cache-Control: public, max-age=5` on the HTTP response.
- Zod-validate any query params (none today -- pattern stays for future-proofing).

## Security

- Rate-limit 60/min/IP via `express-rate-limit` + `rate-limit-redis` store (single middleware shared across public API).
- Response never includes internal-only fields (`port`, `repo`).
- All SQL parameterised.

## Acceptance criteria

- [ ] `curl http://localhost:3012/api/public/status` returns the documented shape
- [ ] Second request within 5s served from Redis (counter or log assertion)
- [ ] 61st request from the same IP within 60s returns 429
- [ ] `tests/publicStatus.test.ts` covers happy path + cache hit + rate-limit
EOF

file_issue \
  "SSE /api/stream -- push status changes to subscribed clients" \
  "tier-2" <<'EOF'
## Context

When a project transitions up<->down, every connected browser dot animates without polling. Native `EventSource` keeps it simple -- no WebSocket framing, no auth handshake.

## Spec

`src/server/services/sseHub.ts`:

- In-memory subscriber registry (`Set<Response>`).
- `subscribe(res)`, `unsubscribe(res)`, `broadcast(event)`.
- Heartbeat every 25s: writes `: ping\n\n` to every subscriber (keeps proxies from closing idle connections).
- Subscriber cap per IP: 5 (reject 6th with 429).
- Hard idle close at 60 minutes (force-close so the registry doesn't grow unbounded under aberrant clients).

`src/server/routes/sseStream.ts`:

- `GET /api/stream` ->
  - `res.setHeader('Content-Type','text/event-stream')`
  - `res.setHeader('Cache-Control','no-cache, no-transform')`
  - `res.setHeader('Connection','keep-alive')`
  - `res.flushHeaders()`
  - `hub.subscribe(res)`
  - `req.on('close', () => hub.unsubscribe(res))`

Events broadcast by the hub:

- `status-change` (data: `{ slug, from, to, at }`) -- emitted by health poller #12 on transition
- `deploy-change` (data: `{ slug, sha, status }`) -- emitted by webhook #22
- Heartbeats are comment lines (no event name)

## Security

- Public endpoint; no auth. The payload is strictly already-public status -- nothing internal.
- Per-IP cap (5 subs) protects against connection-bomb DoS.
- Hard idle close prevents memory leaks on dropped connections.

## Acceptance criteria

- [ ] `curl -N http://localhost:3012/api/stream` holds the connection open and receives a heartbeat within 30s
- [ ] Stopping shortlive -> `status-change` event arrives in the curl output
- [ ] 6th simultaneous connection from one IP returns 429
- [ ] `tests/sseStream.test.ts` with an EventSource-like client verifies wire format
EOF

# ---------------------------------------------------------------------------
# TIER 3 -- Public board UI
# ---------------------------------------------------------------------------

file_issue \
  "Public home: status board with green/red dots per project (greyed for planned)" \
  "tier-3" <<'EOF'
## Context

The marquee page. Every project is a card with a coloured dot. Planned projects are greyed-out with an ETA label.

## Spec

- `src/client/pages/Home.tsx` consumes `useStatus()` (#17, can land in same PR or earlier stub).
- Renders a responsive grid of `ProjectCard` components.
- `src/client/components/ProjectCard.tsx`:
  - Project name + status dot (green=up, red=down, grey=planned/unknown)
  - Latency in ms when `up`
  - "Coming soon -- ETA <date>" when `planned`
  - Anchor to `/p/:slug` for live projects only
- `src/client/components/StatusDot.tsx`: small animated circle. CSS transition on colour change (200ms).

Loading state: skeleton cards (no spinner -- looks more confident).

## Security

- No `dangerouslySetInnerHTML` anywhere.
- No raw HTML from API responses (the API never returns HTML, but linted regardless).
- All text content escaped by React's default behaviour.

## Acceptance criteria

- [ ] `/` shows the shortlive card with a green dot when healthy
- [ ] Planned cards render greyed with ETA
- [ ] Latency updates each poll cycle
- [ ] Mobile layout works at 320px
- [ ] Vitest + jsdom: `tests/Home.test.tsx` renders with a fixture status payload
EOF

file_issue \
  "Uptime sparkline (last 24h) per project on public home" \
  "tier-3" <<'EOF'
## Context

At-a-glance "is this stable?" signal alongside the status dot.

## Spec

- `src/client/components/Sparkline.tsx`: tiny inline SVG. Props: `points: { ts: number; status: 'up'|'down' }[]`. Width 80px x height 16px. Render one vertical bar per ping; up=green, down=red.
- Backend endpoint `GET /api/public/uptime/:slug?window=24h`:
  - Validate `:slug` against the static registry (404 if unknown).
  - Validate `window` with Zod against allowlist `['1h','24h','7d']` (400 if other).
  - Query: `SELECT ts, status FROM health_pings WHERE project = $1 AND ts > now() - $2 ORDER BY ts ASC`.
  - Cache 60s in Redis under `controlroom:uptime:<slug>:<window>`.
- Home renders one `Sparkline` per live project card.

## Security

- Slug pattern `^[a-z0-9-]{1,32}$` enforced via Zod.
- All SQL parameterised.
- Cache key built from validated slug only.

## Acceptance criteria

- [ ] Sparkline renders for shortlive with >=30min of data
- [ ] Planned cards omit the sparkline (no fetch)
- [ ] `?window=foo` returns 400
- [ ] `/api/public/uptime/unknown` returns 404
- [ ] `tests/uptime.test.ts` covers happy path + both errors
EOF

file_issue \
  "Live updates: client subscribes to /api/stream and animates dot transitions" \
  "tier-3" <<'EOF'
## Context

SSE is the demo differentiator. Dots flip without a page refresh. Robust reconnect so a brief network drop is invisible.

## Spec

- `src/client/hooks/useSSE.ts`:
  - Opens `EventSource('/api/stream')` on mount.
  - Exposes `{ lastEvent, connectionState: 'connecting'|'open'|'closed' }`.
  - Reconnect with exponential backoff: 1s, 2s, 4s, 8s, 16s, cap 30s. Reset on successful open.
  - Cleans up on unmount.
- `src/client/hooks/useStatus.ts`:
  - Fetches `/api/public/status` once on mount.
  - Subscribes via `useSSE`.
  - Merges `status-change` events into the snapshot (immutably).
  - Returns the merged list.
- `StatusDot` uses CSS `transition: background-color 200ms ease`.

## Security

- `EventSource` same-origin only.
- Client sends no headers.
- Reconnect backoff bounded so misbehaving server doesn't get hammered.

## Acceptance criteria

- [ ] Stopping shortlive on the VM flips the dot to red within ~30s with no reload
- [ ] Network drop reconnects after backoff (DevTools offline simulation)
- [ ] Idle tab for 10min still receives heartbeats
- [ ] `tests/useSSE.test.tsx` covers reconnect logic with a mocked EventSource
EOF

file_issue \
  "Per-project detail page /p/:slug" \
  "tier-3" <<'EOF'
## Context

Drill-down view: bigger sparkline, last-100 ping table, latest commits, latest deploys. One page per live project.

## Spec

- `src/client/pages/Project.tsx` rendered at route `/p/:slug`. Fetches `GET /api/public/project/:slug`.
- `src/server/routes/publicProject.ts`:
  - Validate `:slug` against the registry (404 if unknown).
  - Query last 100 pings, last 20 rows from `commits_cache`, last 10 from `deploys`.
  - Returns:

    ```json
    {
      "project": { "slug": "...", "name": "...", "status": "live" },
      "recentPings": [],
      "recentCommits": [],
      "recentDeploys": []
    }
    ```

  - Cache 30s in Redis.
- UI reuses `Sparkline` (larger size variant), `CommitCard` (#20), `DeployRow` (#21).
- 404 fallback: `Project not found` page (no stack traces, no internals).

## Security

- Same slug validation as #16.
- Cache key built from validated slug only.
- All SQL parameterised.

## Acceptance criteria

- [ ] `/p/shortlive` renders all four sections
- [ ] `/p/unknown` renders a friendly 404
- [ ] `tests/publicProject.test.ts` covers happy + 404
- [ ] Lint + typecheck clean
EOF

# ---------------------------------------------------------------------------
# TIER 4 -- GitHub data (commits + deploys + CI)
# ---------------------------------------------------------------------------

file_issue \
  "GitHub sync worker: pull last 20 commits per project hourly, cache in commits_cache" \
  "tier-4" <<'EOF'
## Context

Powers commit cards on the home and per-project pages. Server-side only -- the PAT never reaches the browser. Respects GitHub rate limits and isolates per-project failures.

## Spec

`src/server/services/githubSync.ts` exports `startGithubSync()` and `stopGithubSync()`.

Loop body (every 1h):

- For each project with a non-empty `repo`:
  - `GET https://api.github.com/repos/{repo}/commits?per_page=20`
  - Headers: `Authorization: Bearer ${config.GITHUB_PAT}`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`, `User-Agent: controlroom-sync`
  - For each commit: `INSERT INTO commits_cache (project, sha, author, message, ts) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (project, sha) DO NOTHING`
  - Check `X-RateLimit-Remaining` -- if `< 100`, log a warning and break the loop (skip remaining projects this cycle).
- Per-project errors logged + swallowed; one bad repo cannot poison the loop.

Retention: every 6h, keep at most the latest 50 commits per project (windowed delete based on `ts`).

Skip in test. Wire to boot after migrations.

## Security

- PAT is fine-grained, read-only on `pritika292/*`. Stored only in `controlroom.env`, never logged.
- API errors logged with status code + sanitised message only -- never response body (could include PAT echo).
- Per-project try/catch isolates failures.
- Truncate `message` at 1000 chars before insert.

## Acceptance criteria

- [ ] First run populates `commits_cache` for shortlive
- [ ] Second run is idempotent (no duplicates)
- [ ] `tests/githubSync.test.ts` with `nock` covers happy path, rate-limit-near-zero path, and per-project error isolation
- [ ] `grep -i github_pat logs/*` returns clean during a manual run
- [ ] Lint + typecheck clean
EOF

file_issue \
  "Last commit card per project on home (author, message, time)" \
  "tier-4" <<'EOF'
## Context

At-a-glance "is this project being worked on?" signal next to the status dot.

## Spec

- `src/client/components/CommitCard.tsx`:
  - Avatar (img from `https://avatars.githubusercontent.com/...`)
  - First line of commit message (truncated client-side at 80 chars with ellipsis)
  - Relative time ("3h ago") via a tiny helper (no dayjs/moment -- write `relativeTime(ts)` directly)
- Extend `/api/public/status` payload to include per project:

  ```json
  "lastCommit": { "sha": "...", "author": "...", "message": "...", "ts": "..." }
  ```

  or `null` if no cached commit yet. Joined from `commits_cache` via `DISTINCT ON (project) ... ORDER BY project, ts DESC`.

## Security

- Add `https://avatars.githubusercontent.com` to CSP `img-src` (already added in #4 -- verify).
- Truncate `message` at 120 chars server-side before sending.
- Strip `\r` from `message` before serialising (prevents header-injection-style oddities on display).
- React's default text escaping handles the rest.

## Acceptance criteria

- [ ] Commit card renders under the shortlive status dot
- [ ] Long messages don't break the layout (truncation works)
- [ ] Avatar loads without CSP error
- [ ] Lint + typecheck clean
EOF

file_issue \
  "Deploy timeline per project: last 10 deploys (sha, author, duration, result)" \
  "tier-4" <<'EOF'
## Context

"How fast does she ship?" signal -- visible deploy frequency + outcome. Powers the per-project page deploy section and the stats strip.

## Spec

Extend the GitHub sync worker (or split into `src/server/services/deploysSync.ts`):

- For each project hourly: `GET /repos/{repo}/actions/workflows/deploy.yml/runs?per_page=10` with the same auth + headers as #19.
- Map workflow run -> `deploys` row:
  - `sha = head_sha`
  - `actor = actor.login`
  - `started_at = run_started_at`
  - `finished_at = updated_at` (only when `status === 'completed'`, else `null`)
  - `status` from `conclusion` (success/failure/cancelled) or `'running'` if in progress
  - `run_url = html_url`
- Upsert: `INSERT ... ON CONFLICT (project, sha, started_at) DO UPDATE SET status = EXCLUDED.status, finished_at = EXCLUDED.finished_at, run_url = EXCLUDED.run_url`
- If the project has no `deploy.yml` workflow (404), log and skip -- don't error the loop.

Frontend: `src/client/components/DeployRow.tsx` shows sha (7-char), actor, duration (`finished_at - started_at` or `running` chip), status colour. Used on `Project.tsx` (#18).

## Security

- Same PAT/scope guarantees as #19.
- Per-project errors isolated.
- All upsert queries parameterised.

## Acceptance criteria

- [ ] After one sync, shortlive shows last 10 deploys on `/p/shortlive`
- [ ] An in-progress run is updated to success/failure on the next sync
- [ ] `tests/deploysSync.test.ts` with `nock` covers insert, update, and 404 (no workflow) paths
- [ ] Lint + typecheck clean
EOF

file_issue \
  "Webhook receiver: /webhooks/github (HMAC-verified) writes to deploys in real time" \
  "tier-4" <<'EOF'
## Context

The single write endpoint reachable from the public internet. Replaces "wait an hour" with "deploy finishes -> dot updates in seconds". HMAC-verified with the secret from Key Vault.

## Spec

`src/server/routes/webhooksGithub.ts`:

- `POST /webhooks/github` mounted with raw-body middleware (`express.raw({ type: 'application/json', limit: '1mb' })`) -- **NOT** `express.json()`, because HMAC must verify the exact raw bytes.
- Validate presence of `X-Hub-Signature-256`; missing -> 400.
- Verify HMAC: `crypto.createHmac('sha256', secret).update(rawBody).digest('hex')` compared via `crypto.timingSafeEqual`. Mismatch -> 401.
- Parse JSON after verification.
- Switch on `X-GitHub-Event`:
  - `workflow_run`: only act if `workflow_run.name === 'deploy'` and `repository.full_name` matches a known project's `repo`. Upsert into `deploys` (same mapping as #21). Broadcast SSE `deploy-change` event.
  - All other events: 200 OK, no-op (so GitHub stops retrying).
- Rate-limit 30/min/IP (lower than public API).
- Reject payloads > 1 MB (already enforced by raw-body limit).

`scripts/register-webhooks.sh` (per PLAN.md `[opus]` spec):

- Reads webhook secret via `az keyvault secret show --vault-name pritika-portfolio-kv --name controlroom-github-webhook-secret --query value -o tsv` into a shell variable (never echoed).
- Registers a webhook on `pritika292/shortlive` only (other projects added as they go live).
- URL: `http://135.232.183.50:3012/webhooks/github` (port-direct until Caddy lands in Tier 6, then update the script).
- Events: `workflow_run` only.
- `content_type: json`, `insecure_ssl: 0`.
- Idempotent: if a webhook with the same URL already exists, update its secret + events instead of creating a duplicate.
- Use `gh api -X POST repos/.../hooks --input -` with the JSON payload piped in (no secret in argv / shell history).

## Security

- `crypto.timingSafeEqual` for HMAC comparison (constant-time).
- Raw body retained only for HMAC, then parsed once.
- Webhook secret read from env at boot, never logged, redacted via `redact()`.
- Payload size capped at 1 MB.
- `register-webhooks.sh`: secret never on the command line, never echoed, never written to disk except into Key Vault directly.
- Endpoint exists in the `getOnly` middleware bypass list (#4).

## Acceptance criteria

- [ ] Real GitHub `workflow_run` event from shortlive lands in `deploys` within 5s of receipt
- [ ] Same request with one signature byte flipped returns 401
- [ ] Same request without `X-Hub-Signature-256` returns 400
- [ ] Payload >1 MB returns 413
- [ ] `tests/webhooksGithub.test.ts` covers all four + the SSE broadcast
- [ ] `scripts/register-webhooks.sh` does not leak the secret in shell history or process listings
EOF

file_issue \
  "Public stats strip on home: total deploys this week, total commits, projects live" \
  "tier-4" <<'EOF'
## Context

Founder hook at the top of the home page. Three hard numbers showing velocity at a glance.

## Spec

`GET /api/public/stats` returns:

```json
{
  "deploysThisWeek": 14,
  "commitsThisWeek": 73,
  "projectsLive": 1,
  "projectsPlanned": 10
}
```

Implementation:

- `deploysThisWeek`: `SELECT count(*) FROM deploys WHERE started_at > now() - INTERVAL '7 days' AND status = 'success'`
- `commitsThisWeek`: `SELECT count(*) FROM commits_cache WHERE ts > now() - INTERVAL '7 days'`
- `projectsLive` / `projectsPlanned`: from the static registry
- Cache 60s in Redis under `controlroom:stats:weekly:YYYY-MM-DD` (date bucket prevents stale value surviving midnight)

Frontend: `src/client/components/StatsStrip.tsx` rendered above the project grid on Home.

## Security

- Returns numbers only -- no per-project leakage beyond what's already on the home.
- All SQL parameterised.
- Cache key built from date string, not user input.

## Acceptance criteria

- [ ] Strip renders at top of `/`
- [ ] Numbers refresh within 60s of new deploys / commits being synced
- [ ] Cache key rolls over at UTC midnight (so a stale value cannot persist past day boundary)
- [ ] `tests/publicStats.test.ts` covers the aggregator with fixture data
EOF

# ---------------------------------------------------------------------------
# TIER 5 -- Incidents
# ---------------------------------------------------------------------------

file_issue \
  "Incidents as markdown files under content/incidents/*.md" \
  "tier-5" <<'EOF'
## Context

When something breaks, Pritika commits a markdown file. The home shows a red banner while any incident with `severity: high` has no `closed:` date. No DB editor -- git is the editor. Per PLAN.md `[opus]` resolution: load once at boot, no live file-watcher in prod (container restarts on deploy refresh the list).

## Spec

`content/incidents/` directory committed to the repo. One file per incident.

File format (e.g. `content/incidents/2026-05-shortlive-redis.md`):

```markdown
---
title: shortlive Redis timeout
severity: high
project: shortlive
opened: 2026-05-22T10:00:00Z
closed: null
---

Body in markdown.
```

Frontmatter schema (Zod, `strict()`):

- `title`: string (1..200)
- `severity`: enum `['low','medium','high']`
- `project`: string (must match a known slug; bad ones are logged + skipped, never crash boot)
- `opened`: ISO datetime
- `closed`: ISO datetime or null

`src/server/services/incidentsLoader.ts`:

- At boot, read all `*.md` files in `content/incidents/`. Filename must match `^[\w.-]+\.md$` (defence in depth even though files come from the repo).
- Parse with `gray-matter`. Validate frontmatter with Zod (strict). Bad files logged + skipped.
- Build an in-memory map keyed by filename. Expose `getOpenIncidents()` (no `closed`), `getAllIncidents()`.
- No `chokidar`, no `fs.watch`. Container restart on deploy is the refresh mechanism.
- Extend `dev` script to include `content/**/*.md` in tsx's watch glob (verify tsx supports this; fall back to `nodemon --watch content` if not).

`GET /api/public/incidents` returns the loaded structures (no re-parsing per request).

Frontend:

- `src/client/components/IncidentBanner.tsx` renders the most recent open high-severity incident on Home.
- Markdown body rendered client-side via `marked` (GFM enabled) then sanitised with `isomorphic-dompurify`. Never `dangerouslySetInnerHTML` on raw input.

## Security

- Filename pattern validated before any `fs.readFile`.
- Frontmatter Zod schema is `strict()` -- unknown fields rejected.
- Markdown sanitised with `isomorphic-dompurify` regardless of source.
- A malformed file logs + skips; never crashes boot.

## Acceptance criteria

- [ ] Committing a `severity: high` open incident -> after redeploy, banner appears on Home
- [ ] Setting `closed:` to a date -> next deploy hides the banner
- [ ] Bad frontmatter file is logged and skipped, boot succeeds
- [ ] XSS attempt in body (`<img src=x onerror=alert(1)>`) is sanitised
- [ ] `tests/incidents.test.ts` covers loader, schema rejection, and sanitiser output
- [ ] Lint + typecheck clean
EOF

# ---------------------------------------------------------------------------
# TIER 6 -- TLS + polish
# ---------------------------------------------------------------------------

file_issue \
  "TLS via Caddy + auto Let's Encrypt + HTTP->HTTPS redirect + About page + docs/09 writeup" \
  "tier-6" <<'EOF'
## Context

Portfolio URL needs HTTPS. Caddy provides auto-renewal + zero-config. This issue also closes out the project with the About page and the deep-dive writeup in PProjects.

## Spec

**Caddy:**

- Add a `caddy` service to `/opt/pritika/_infra/docker-compose.yml`:

  ```yaml
  caddy:
    image: caddy:2.8-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - /opt/pritika/_infra/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks: [pritika]
  ```

- `/opt/pritika/_infra/Caddyfile`:

  ```
  status.pritika.dev {
    reverse_proxy controlroom:3012
  }
  # Routes for other projects can be added as they go live.
  ```

- DNS: confirm `status.pritika.dev` (or chosen domain) A-records to `135.232.183.50` before merging.

**Express:**

- `app.set('trust proxy', 1)` so `req.ip` reflects the Caddy `X-Forwarded-For` (only the immediate upstream is trusted).
- Enable HSTS in helmet: `hsts: { maxAge: 31536000, includeSubDomains: false, preload: false }`. Preload off at v1 -- keeps rollback safe if the cert breaks.

**Update `scripts/register-webhooks.sh`:**

- Webhook URL changes from `http://135.232.183.50:3012/webhooks/github` -> `https://status.pritika.dev/webhooks/github`. Re-run the script after Caddy is live.

**About page + docs:**

- `src/client/pages/About.tsx`: short copy explaining what ControlRoom is and how the architecture works (1-2 paragraphs + a small diagram or bullet list).
- `PProjects/docs/09-controlroom-deep-dive.md`: ~600-word writeup mirroring the depth of `docs/08-shortlive-deep-dive.md`. Cover: scope decisions (why no admin), security model, data flow, deployment path, what the SSE channel carries.

## Security

- Verify Caddy auto-renewal works (`docker logs caddy | grep -i cert`).
- HSTS preload NOT enabled at v1.
- Caddy reverse-proxies; Express never sees TLS-terminated traffic directly.
- After flipping to HTTPS, run `nmap -p- 135.232.183.50` to confirm only 22, 80, 443 (and the project ports for direct hits) are exposed.
- `trust proxy: 1` -- single upstream only; do NOT use `true` (would trust arbitrary `X-Forwarded-For` chains).

## Acceptance criteria

- [ ] `https://status.pritika.dev` (or chosen domain) loads with a valid Let's Encrypt cert
- [ ] `curl -I http://status.pritika.dev` returns 308 -> HTTPS
- [ ] `Strict-Transport-Security` header present on HTTPS responses
- [ ] About page reachable at `/about`
- [ ] `PProjects/docs/09-controlroom-deep-dive.md` committed (separate PR in that repo)
- [ ] Webhook URL updated and `register-webhooks.sh` re-run successfully against shortlive
EOF

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------

echo
echo "All 25 issues queued or already filed."
echo "Verify with: gh issue list -R $REPO -L 30"
