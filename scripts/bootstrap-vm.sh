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

if [ -z "${GITHUB_PAT:-}" ]; then
  echo "ERROR: GITHUB_PAT missing from $INFRA_ENV — add it with: echo 'GITHUB_PAT=<fine-grained PAT>' >> /opt/pritika/_infra/.env" >&2
  exit 1
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

umask 077
cat > "$PROJECT_ENV" <<EOF
NODE_ENV=production
PORT=3012
DATABASE_URL=postgres://postgres:${POSTGRES_PASSWORD}@pritika-postgres:5432/controlroom
REDIS_URL=redis://:${REDIS_PASSWORD}@pritika-redis:6379/12
GITHUB_PAT=${GITHUB_PAT}
GITHUB_WEBHOOK_SECRET=${GITHUB_WEBHOOK_SECRET}
EOF
log "Wrote $PROJECT_ENV (mode 600)"

log "Bootstrap complete"
