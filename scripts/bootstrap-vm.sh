#!/usr/bin/env bash
# Run on the VM (via az vm run-command) before the docker compose deploy.
# Idempotent — safe to run on every deploy. Existing secrets are preserved;
# missing keys are filled in.

set -euo pipefail

INFRA_ENV="/opt/pritika/_infra/.env"
PROJECT_ENV="/opt/pritika/_infra/controlroom.env"

log() { printf "[bootstrap-vm] %s\n" "$*"; }

if [ ! -f "$INFRA_ENV" ]; then
  echo "ERROR: $INFRA_ENV not found — run setup-vm.sh first." >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
. "$INFRA_ENV"
set +a

if [ -z "${POSTGRES_PASSWORD:-}" ] || [ -z "${REDIS_PASSWORD:-}" ]; then
  echo "ERROR: POSTGRES_PASSWORD or REDIS_PASSWORD missing from $INFRA_ENV" >&2
  exit 1
fi

# GITHUB_PAT is user-supplied; read from the shared infra env under the
# project-specific key. If absent, proceed with an empty value — Tier 0-3
# features do not require GitHub API access.
GITHUB_PAT="${CONTROLROOM_GITHUB_PAT:-}"
if [ -z "$GITHUB_PAT" ]; then
  log "GITHUB_PAT not set — Tier 4 GitHub sync will be inactive"
fi

log "Ensuring controlroom database exists"
if docker exec pritika-postgres psql -U postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='controlroom'" | grep -q 1; then
  log "Database 'controlroom' already present"
else
  docker exec pritika-postgres psql -U postgres -c "CREATE DATABASE controlroom"
  log "Created database 'controlroom'"
fi

# Preserve any existing secrets so webhook HMAC remains stable across deploys.
# Generate only what's missing.
read_existing() {
  local key="$1"
  if [ -f "$PROJECT_ENV" ]; then
    grep "^${key}=" "$PROJECT_ENV" | head -1 | cut -d= -f2- || true
  fi
}

GITHUB_WEBHOOK_SECRET="$(read_existing GITHUB_WEBHOOK_SECRET)"
if [ -z "$GITHUB_WEBHOOK_SECRET" ]; then
  GITHUB_WEBHOOK_SECRET="$(openssl rand -hex 32)"
  log "Generated new GITHUB_WEBHOOK_SECRET"
fi

# Pull the VM's own resource id and subscription id from the Azure Instance
# Metadata Service. The container uses these to call Azure Monitor via the
# VM's Managed Identity. If IMDS isn't reachable (running outside Azure),
# both stay empty and vmMetrics() reports "metrics unavailable" instead of
# crashing.
IMDS_JSON="$(curl -sS --max-time 3 -H 'Metadata: true' \
  'http://169.254.169.254/metadata/instance?api-version=2021-12-13' 2>/dev/null || true)"
AZURE_VM_RESOURCE_ID=""
AZURE_SUBSCRIPTION_ID=""
if [ -n "$IMDS_JSON" ] && command -v jq >/dev/null 2>&1; then
  AZURE_VM_RESOURCE_ID="$(printf '%s' "$IMDS_JSON" | jq -r '.compute.resourceId // empty')"
  AZURE_SUBSCRIPTION_ID="$(printf '%s' "$IMDS_JSON" | jq -r '.compute.subscriptionId // empty')"
fi
if [ -n "$AZURE_VM_RESOURCE_ID" ]; then
  log "VM resource id resolved via IMDS"
else
  log "IMDS unreachable or jq missing; VM metrics will be unavailable"
fi

umask 077
cat > "$PROJECT_ENV" <<EOF
NODE_ENV=production
PORT=3012
DATABASE_URL=postgres://postgres:${POSTGRES_PASSWORD}@pritika-postgres:5432/controlroom
REDIS_URL=redis://:${REDIS_PASSWORD}@pritika-redis:6379/12
GITHUB_PAT=${GITHUB_PAT}
GITHUB_WEBHOOK_SECRET=${GITHUB_WEBHOOK_SECRET}
AZURE_VM_RESOURCE_ID=${AZURE_VM_RESOURCE_ID}
AZURE_SUBSCRIPTION_ID=${AZURE_SUBSCRIPTION_ID}
LOG_LEVEL=info
EOF
log "Wrote $PROJECT_ENV (mode 600)"

log "Bootstrap complete"
